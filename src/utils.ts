import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { exec, ExecOptions } from 'child_process';
import winston, { Logger } from 'winston';
import { FailedCheckovCheck } from './checkov';
import { DiagnosticReferenceCode } from './diagnostics';
import { CHECKOV_MAP } from './extension';
import { showUnsupportedFileMessage } from './userInterface';
import * as path from 'path';
import { FileCache, ResultsCache } from './checkov/models';
import axios from 'axios';

const extensionData = vscode.extensions.getExtension('bridgecrew.checkov');
export const extensionVersion = extensionData ? extensionData.packageJSON.version : 'unknown';

// Matches the following URLs with group 4 == 'org/repo':
// git://github.com/org/repo.git
// git@github.com:org/repo.git
// https://github.com/org/repo.git
// eslint-disable-next-line no-useless-escape

// See comment in "parseRepoName"
// const repoUrlRegex = /^(https|git)(:\/\/|@)([^\/:]+)[\/:](.+).git$/;

export const isWindows = process.platform === 'win32';

export const cacheDateKey = 'CKV_CACHE_DATE';
export const cacheResultsKey = 'CKV_CACHE_RESULTS';
export const checkovVersionKey = 'CKV_VERSION';

export const checkovVersionApi = 'api/v1/checkovVersion';

const maxCacheSizePerFile = 10;

const unsupportedExtensions: string[] = ['.log'];
const unsupportedFileNames: string[] = [];

export type TokenType = 'bc-token' | 'prisma';

export type FileScanCacheEntry = {
    fileHash: string,
    filename: string,
    results: FailedCheckovCheck[]
};

type ExecOutput = [stdout: string, stderr: string];
export const asyncExec = async (commandToExecute: string, options: ExecOptions = {}): Promise<ExecOutput> => {
    const defaultOptions: ExecOptions = { maxBuffer: 1024 * 1000 };
    return new Promise((resolve, reject) => {
        exec(commandToExecute, { ...defaultOptions, ...options }, (err, stdout, stderr) => {
            if (err) { return reject(err); }
            resolve([stdout, stderr]);
        });
    });
};

export const isSupportedFileType = (fileName: string, showMessage = false): boolean => {
    const isExtensionNotSupported = unsupportedExtensions.some(extension => fileName.endsWith(extension));
    const isFileNameNotSupported = unsupportedFileNames.some(name => fileName.match(name));
    if (isExtensionNotSupported || isFileNameNotSupported) {
        showMessage && showUnsupportedFileMessage();
        return false;
    }
    return true;
};

export const saveCheckovResult = (state: vscode.Memento, checkovFails: FailedCheckovCheck[]): void => {
    const checkovMap = checkovFails.reduce((prev, current) => ({
        ...prev,
        [createCheckovKey(current)]: current
    }), []);
    state.update(CHECKOV_MAP, checkovMap);
};

export const createDiagnosticKey = (diagnostic: vscode.Diagnostic): string => {
    let checkId;
    if (typeof(diagnostic.code) === 'string') {
        // code is a custom policy in format: policy_id[:guideline]
        const colonIndex = diagnostic.code.indexOf(':');
        checkId = colonIndex === -1 ? diagnostic.code : diagnostic.code.substring(0, colonIndex);
    } else {
        checkId = (diagnostic.code as DiagnosticReferenceCode).value;
    }
    return `${checkId}-${diagnostic.range.start.line + 1}`;
};
export const createCheckovKey = (checkovFail: FailedCheckovCheck): string => `${checkovFail.checkId}-${checkovFail.fileLineRange[0]}`;

export const getLogger = (logFileDir: string, logFileName: string): winston.Logger => winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.printf(({ level, message, ...rest }) => {
            const logError = rest.error && rest.error instanceof Error ? { error: { ...rest.error, message: rest.error.message, stack: rest.error.stack } } : {};
            const argumentsString = JSON.stringify({ ...rest, ...logError });
            return `[${level}]: ${message} ${argumentsString !== '{}' ? argumentsString : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({
            level: 'debug',
            dirname: logFileDir,
            filename: logFileName
        })
    ]
});

export const convertToUnixPath = (path: string): string => {
    const isExtendedLengthPath = /^\\\\\?\\/.test(path);
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\u0000-\u0080]+/.test(path);

    if (isExtendedLengthPath || hasNonAscii) {
        return `"${path}"`;
    }

    return `"${path.replace(/\\/g, '/')}"`;
};

export const getWorkspacePath = (logger: winston.Logger): string | void => {
    if(vscode.workspace) {
        if(vscode.workspace.workspaceFolders) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            logger.warn('No folder open in workspace.');
        }
    } 
    logger.warn('No workspace open.');
    return;
};

export const runVersionCommand = async (logger: winston.Logger, checkovPath: string, checkovVersion: string | undefined): Promise<string> => {
    const command = checkovPath === 'docker' ? `docker run --rm bridgecrew/checkov:${checkovVersion} -v` : `${checkovPath} -v`;
    logger.debug(`Version command: ${command}`);
    const resp = await asyncExec(command);
    logger.debug(`Response from version command: ${resp[0]}`);
    return resp[0].trim();
};

export const getGitRepoName = async (logger: winston.Logger, filename: string | undefined): Promise<string | null> => {
    if (!filename) {
        logger.debug('Filename was empty when getting git repo; returning default');
        return null;
    }
    const cwd = path.dirname(filename);
    try {
        const output = await asyncExec('git remote -v', { cwd });

        if (output[1]) {
            logger.info(`Got stderr output when getting git repo; returning null. Output: ${output[1]}`);
            return null;
        }
        logger.debug(`Output:\n${output[0]}`);

        const lines = output[0].split('\n');
    
        let firstLine; // we'll save this and come back to it if we don't find 'origin'
        for (const line of lines) {
            if (!firstLine) {
                firstLine = line;
            }
            if (line.startsWith('origin')) {
                // remove the upstream name from the front and ' (fetch)' or ' (push)' from the back
                const repoUrl = line.split('\t')[1].split(' ')[0];
                logger.info('repo url' + repoUrl);
                const repoName = parseRepoName(repoUrl);
                logger.info('repo name' + repoName);
                if (repoName) {
                    return repoName;
                }
            }
        }

        // if we're here, then there is no 'origin', so just take the first line as a default (regardless of how many upsteams there happen to be)
        if (firstLine) {
            const repoUrl = firstLine.split('\t')[1].split(' ')[0];
            const repoName = parseRepoName(repoUrl);
            if (repoName) {
                return repoName;
            }
        }

        logger.debug('Did not find any valid repo URL in the "git remote -v" output; returning null');
    } catch (error) {
        logger.debug('git remote -v command failed; returning null', error);
    }
    return null;
};

export const getDockerPathParams = (workspaceRoot: string | undefined, filePath: string): [string | null, string] => {
    if (!workspaceRoot) {
        return [null, filePath];
    }
    const relative = path.relative(workspaceRoot, filePath);
    return relative.length > 0 && !relative.startsWith('../') && !relative.startsWith('..\\') && !path.isAbsolute(relative) ? [workspaceRoot, relative] : [null, filePath];
};

const parseRepoName = (repoUrl: string): string | null => {
    if (repoUrl.endsWith('/')) {
        repoUrl = repoUrl.substring(0, repoUrl.length - 1);
    }
    const lastSlash = repoUrl.lastIndexOf('/');
    if (lastSlash === -1) {
        return null;
    }
    // / is used in https URLs, and : in git@ URLs
    const priorSlash = repoUrl.lastIndexOf('/', lastSlash - 1);
    const priorColon = repoUrl.lastIndexOf(':', lastSlash - 1);

    if (priorSlash === -1 && priorColon === -1) {
        return null;
    }

    const endsWithDotGit = repoUrl.endsWith('.git');
    const repoName = repoUrl.substring(Math.max(priorSlash, priorColon) + 1, endsWithDotGit ? repoUrl.length - 4 : repoUrl.length);

    // handle VCSes with less standard git remote URLs (uhh, looking at you CodeCommit)
    // example: codecommit::us-west-2://repo_name
    // gets parsed as `/repo_name` and there is no good value to use as the repo "org"
    return repoName.split('/').some(s => s === '') ? null : repoName;

    // Commenting out for now, because the code above is a temporary workaround to the case where the git server
    // is not hosted at the root level (e.g., https://company.example.com/git)
    // const result = repoUrlRegex.exec(repoUrl);
    // return result ? result[4] : null;
};

export const getTokenType = (token: string): TokenType => token.includes('::') ? 'prisma' : 'bc-token';

export const getPlatformCheckovVersion = async (token: string, prismaApiUrl: string | undefined, logger: winston.Logger): Promise<string> => {
    
    const url = `${prismaApiUrl ? `${prismaApiUrl}/code/` : 'https://www.bridgecrew.cloud/'}${checkovVersionApi}`;

    logger.debug(`Checkov version URL: ${url}`);

    if (prismaApiUrl) {
        token = await getPrismaLoginToken(token, prismaApiUrl);
        logger.debug('Successfully authenticated to Prisma /login');
    }
    
    const resp = await axios.get(url, {
        headers: {
            'Authorization': token
        }
    });

    if (resp.status !== 200) {
        throw Error(`Got unexpected response from platform version API (status code ${resp.status}): ${resp.data}`);
    }

    return resp.data.version;
};

const getPrismaLoginToken = async (token: string, prismaApiUrl: string): Promise<string> => {
    const url = `${prismaApiUrl}/login`;
    const [username, password] = token.split('::');
    const body = { username, password };
    const headers = {
        'Content-Type': 'application/json'
    };
    const resp = await axios.post(url, body, { headers });

    if (resp.status !== 200) {
        throw Error(`Got unexpected response from Prisma login endpoint (status code ${resp.status}): ${resp.data}`);
    }

    return resp.data.token;
};

export const normalizePath = (filePath: string): string[] => {
    const absPath = path.resolve(filePath);
    return [path.basename(absPath), absPath];
};

export const getFileHash = (filename: string): string => {
    const fileBuffer = fs.readFileSync(filename);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
};

export const getCachedResults = (context: vscode.ExtensionContext, fileHash: string, filename: string, logger: Logger): FileScanCacheEntry | undefined => {
    logger.debug(`Getting cached results for hash ${fileHash}`);
    validateCacheExpiration(context, logger);
    const cache: ResultsCache | undefined = context.workspaceState.get(cacheResultsKey);
    return cache && cache[filename] ? findSavedScanForFile(fileHash, filename, cache[filename]) : undefined;
};

export const saveCachedResults = (context: vscode.ExtensionContext, fileHash: string, filename: string, results: FailedCheckovCheck[], logger: Logger): void => {
    logger.debug(`Saving results for file ${filename} (hash: ${fileHash})`);
    validateCacheExpiration(context, logger);

    const cache: ResultsCache | undefined = context.workspaceState.get(cacheResultsKey);
    if (cache) {
        let fileCache = cache[filename];
        if (!fileCache) {
            logger.debug(`First cache entry for file ${filename}`);
            fileCache = { oldest: 0, elements: [] }; 
            cache[filename] = fileCache;
        } 
        
        const entry: FileScanCacheEntry = { fileHash, filename, results };
        if (!fileCacheContainsEntry(entry, fileCache)) {
            addSavedScanForFile(entry, fileCache);
            logger.debug(`File ${filename} now has ${fileCache.elements.length} saved results`);
        } else {
            logger.debug(`Cache for file ${filename} already has an entry for hash ${fileHash}`);
        }
    }
};

export const clearCache = (context: vscode.ExtensionContext, logger: Logger): void => {
    logger.debug('Clearing results cache');
    context.workspaceState.update(cacheResultsKey, undefined);  // undefined removes the key
    context.workspaceState.update(cacheDateKey, undefined);
};

const getDate = (): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
};

const validateCacheExpiration = (context: vscode.ExtensionContext, logger: Logger): void => {
    const today = getDate();
    logger.debug(`Today: ${today}`);
    const cacheDate = context.workspaceState.get(cacheDateKey);
    logger.debug(`Cache date: ${cacheDate}`);

    if (cacheDate !== today) {
        logger.debug('Cache date was not set or cache is stale. Starting new cache.');
        context.workspaceState.update(cacheResultsKey, {});
        context.workspaceState.update(cacheDateKey, today);
    } else {
        logger.debug(`Cache date (${cacheDate}) is not stale`);
    }
};

const addSavedScanForFile = (element: FileScanCacheEntry, fileCache: FileCache): void => {
    if (fileCache.elements.length < maxCacheSizePerFile) {
        fileCache.elements.push(element);
    } else {
        fileCache.elements[fileCache.oldest] = element;
        fileCache.oldest++;
        if (fileCache.oldest === fileCache.elements.length) {
            fileCache.oldest = 0;
        }
    }
};

const findSavedScanForFile = (fileHash: string, filename: string, fileCache: FileCache): FileScanCacheEntry | undefined => {
    return fileCache.elements.find(e => e.fileHash === fileHash && e.filename === filename);
};

const fileCacheContainsEntry = (element: FileScanCacheEntry, fileCache: FileCache): boolean => {
    return findSavedScanForFile(element.fileHash, element.filename, fileCache) !== undefined;
};
