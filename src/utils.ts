import * as vscode from 'vscode';
import { exec, ExecOptions } from 'child_process';
import winston from 'winston';
import { FailedCheckovCheck } from './checkov';
import { DiagnosticReferenceCode } from './diagnostics';
import { CHECKOV_MAP } from './extension';
import { showUnsupportedFileMessage } from './userInterface';
import * as path from 'path';

const extensionData = vscode.extensions.getExtension('bridgecrew.checkov');
export const extensionVersion = extensionData ? extensionData.packageJSON.version : 'unknown';
const defaultRepoName = 'vscode/extension';
// Matches the following URLs with group 4 == 'org/repo':
// git://github.com/org/repo.git
// git@github.com:org/repo.git
// https://github.com/org/repo.git
// eslint-disable-next-line no-useless-escape

// See comment in "parseRepoName"
// const repoUrlRegex = /^(https|git)(:\/\/|@)([^\/:]+)[\/:](.+).git$/;

export const isWindows = process.platform === 'win32';

export type TokenType = 'bc-token' | 'prisma';

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
    if (!(fileName.endsWith('.tf') || fileName.endsWith('.yml') || fileName.endsWith('.yaml') || fileName.endsWith('.json') || fileName.match('Dockerfile') || fileName.endsWith('.gradle')  || fileName.endsWith('.gradle.kts')  || fileName.endsWith('.sum')  || fileName.endsWith('.properties')  || fileName.endsWith('.xml')  || fileName.endsWith('.txt') || fileName.match('METADATA'))) {
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

export const getGitRepoName = async (logger: winston.Logger, filename: string | undefined): Promise<string> => {
    if (!filename) {
        logger.debug('Filename was empty when getting git repo; returning default');
        return defaultRepoName;
    }
    const cwd = path.dirname(filename);
    try {
        const output = await asyncExec('git remote -v', { cwd });

        if (output[1]) {
            logger.info(`Got stderr output when getting git repo; returning default. Output: ${output[1]}`);
            return defaultRepoName;
        }
        logger.debug(`Output:\n${output[0]}`);

        const lines = output[0].split('\n');
    
        let firstLine; // we'll save this and come back to it if we don't find 'origin'
        for (const line of lines) {
            if (!firstLine) {
                firstLine = line;
            }
            if (line.startsWith('origin')) {
            // remove the upstream name from the front and '(fetch)' or '(push)' from the back
                const repoUrl = line.split('\t')[1].split(' ')[0];
                const repoName = parseRepoName(repoUrl);
                if (repoName) {
                    return repoName;
                }
            }
        }

        // if we're here, then there is no 'origin', so just take the first line as a default (regardless of how many upsteams there happen to be)
        if (firstLine) {
            const repoUrl = firstLine.split('\t')[1];
            const repoName = parseRepoName(repoUrl);
            if (repoName) {
                return repoName;
            }
        }

        logger.debug('Did not find any valid repo URL in the "git remote -v" output; returning default');
    } catch (error) {
        logger.debug('git remote -v command failed; returning default', error);
    }
    return defaultRepoName;
};

export const getDockerPathParams = (workspaceRoot: string | undefined, filePath: string): [string | null, string] => {
    if (!workspaceRoot) {
        return [null, filePath];
    }
    const relative = path.relative(workspaceRoot, filePath);
    return relative.length > 0 && !relative.startsWith('../') && !relative.startsWith('..\\') && !path.isAbsolute(relative) ? [workspaceRoot, relative] : [null, filePath];
};

const parseRepoName = (repoUrl: string): string | null => {
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
    return repoUrl.substring(Math.max(priorSlash, priorColon) + 1, endsWithDotGit ? repoUrl.length - 4 : repoUrl.length);

    // Commenting out for now, because the code above is a temporary workaround to the case where the git server
    // is not hosted at the root level (e.g., https://company.example.com/git)
    // const result = repoUrlRegex.exec(repoUrl);
    // return result ? result[4] : null;
};

export const getTokenType = (token: string): TokenType => token.includes('::') ? 'prisma' : 'bc-token';

export const normalizePath = (filePath: string): string[] => {
    const absPath = path.resolve(filePath);
    return [path.basename(absPath), absPath];
};
