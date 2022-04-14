import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import { Logger } from 'winston';
import { CheckovInstallation } from './checkovInstaller';
import { convertToUnixPath, getGitRepoName, getDockerPathParams, runVersionCommand, normalizePath } from '../utils';
import { CheckovResponse, CheckovResponseRaw } from './models';
import { parseCheckovResponse } from './checkovParser';



const dockerMountDir = '/checkovScan';
const configMountDir = '/checkovConfig';
const caMountDir = '/checkovCert';

const getDockerFileMountParams = (mountDir: string, filePath: string | undefined): string[] => {
    if (!filePath) {
        return [];
    }

    const [baseName, absPath] = normalizePath(filePath);

    return ['-v', `"${absPath}:${mountDir}/${baseName}"`];
};

const getDockerRunParams = (workspaceRoot: string | undefined, filePath: string, extensionVersion: string, configFilePath: string | undefined, checkovVersion: string | undefined, prismaUrl: string | undefined, certPath: string | undefined, debugLogs: boolean | undefined) => {
    const image = `bridgecrew/checkov:${checkovVersion}`;
    const pathParams = getDockerPathParams(workspaceRoot, filePath);
    // if filepath is within the workspace, then the mount root will be the workspace path, and the file path will be the relative file path from there.
    // otherwise, we will mount into the file's directory, and the file path is just the filename.
    const mountRoot = pathParams[0] || path.dirname(pathParams[1]);
    const filePathToScan = convertToUnixPath(pathParams[0] ? pathParams[1] : path.basename(filePath));
    const prismaUrlParams = prismaUrl ? ['--env', `PRISMA_API_URL=${prismaUrl}`] : [];
    const debugLogParams = debugLogs ? ['--env', 'LOG_LEVEL=DEBUG'] : [];

    const caCertDockerParams = getDockerFileMountParams(caMountDir, certPath);
    const caCertCheckovParams = certPath ? ['--ca-certificate', `"${caMountDir}/${path.basename(certPath)}"`] : [];

    const configFileDockerParams = getDockerFileMountParams(configMountDir, configFilePath);
    const configFileCheckovParams = configFilePath ? ['--config-file', `"${configMountDir}/${path.basename(configFilePath)}"`] : [];
    
    const dockerParams = ['run', '--rm', '--tty', ...prismaUrlParams, ...debugLogParams, '--env', 'BC_SOURCE=vscode', '--env', `BC_SOURCE_VERSION=${extensionVersion}`,
        '-v', `"${mountRoot}:${dockerMountDir}"`, ...caCertDockerParams, ...configFileDockerParams, '-w', dockerMountDir];
    
    return [...dockerParams, image, ...configFileCheckovParams, ...caCertCheckovParams, '-f', filePathToScan];
};

const getpipRunParams = (configFilePath: string | undefined) => {
    return configFilePath ? ['--config-file', configFilePath] : [];
};

const cleanupStdout = (stdout: string) => stdout.replace(/.\[0m/g,''); // Clean docker run ANSI escapse chars

export const runCheckovScan = (logger: Logger, checkovInstallation: CheckovInstallation, extensionVersion: string, fileName: string, token: string, 
    certPath: string | undefined, useBcIds: boolean | undefined, debugLogs: boolean | undefined, cancelToken: vscode.CancellationToken, configPath: string | undefined, checkovVersion: string, prismaUrl: string | undefined): Promise<CheckovResponse> => {
    return new Promise((resolve, reject) => {   
        const { checkovInstallationMethod, checkovPath } = checkovInstallation;
        const dockerRunParams = checkovInstallationMethod === 'docker' ? getDockerRunParams(vscode.workspace.rootPath, fileName, extensionVersion, configPath, checkovInstallation.version, prismaUrl, certPath, debugLogs) : [];
        const pipRunParams =  ['pipenv', 'pip3'].includes(checkovInstallationMethod) ? getpipRunParams(configPath) : [];
        const filePathParams = checkovInstallationMethod === 'docker' ? [] : ['-f', `"${fileName}"`];
        const certificateParams: string[] = certPath && checkovInstallationMethod !== 'docker' ? ['-ca', `"${certPath}"`] : [];
        const bcIdParam: string[] = useBcIds ? ['--output-bc-ids'] : [];
        const workingDir = vscode.workspace.rootPath;
        getGitRepoName(logger, vscode.window.activeTextEditor?.document.fileName).then((repoName) => {
            const repoIdParams = repoName ? ['--repo-id', repoName] : [];
            const checkovArguments: string[] = [...dockerRunParams, ...certificateParams, ...bcIdParam, '-s', '--bc-api-key', token, 
                ...repoIdParams, ...filePathParams, '-o', 'json', ...pipRunParams];
            logger.info('Running checkov:');
            logger.info(`${checkovPath} ${checkovArguments.map(argument => argument === token ? '****' : argument).join(' ')}`);
        
            runVersionCommand(logger, checkovPath, checkovVersion);

            const debugLogEnv = debugLogs ? { LOG_LEVEL: 'DEBUG' } : {};
        
            const ckv = spawn(checkovPath, checkovArguments,
                {
                    shell: true,
                    env: { ...process.env, BC_SOURCE: 'vscode', BC_SOURCE_VERSION: extensionVersion, PRISMA_API_URL: prismaUrl, ...debugLogEnv },
                    ...(workingDir ? { cwd: workingDir } : {})
                });

            let stdout = '';

            ckv.stdout.on('data', data => {
                if (data.toString().startsWith('{') || data.toString().startsWith('[') || stdout) {
                    stdout += data;
                } else {
                    logger.debug(`Log from Checkov: ${data}`);
                }
            });

            ckv.stderr.on('data', data => {
                logger.warn(`Checkov stderr: ${data}`);
            });

            ckv.on('error', (error) => {
                logger.error('Error while running Checkov', { error });
            });

            ckv.on('close', code => {
                try {
                    if (cancelToken.isCancellationRequested) return reject('Cancel invoked');
                    logger.debug(`Checkov scan process exited with code ${code}`);
                    
                    try {
                        const results = JSON.parse(stdout);
                        logger.debug('Checkov task output:');
                        logger.debug(JSON.stringify(results, null, 2));
                    } catch (err) {
                        logger.debug('Checkov task output:', { stdout });
                    }

                    if (code !== 0) return reject(`Checkov exited with code ${code}`);

                    if (stdout.startsWith('[]')) {
                        logger.debug('Got an empty reply from checkov', { reply: stdout, fileName });
                        return resolve({ results: { failedChecks: [] } });
                    }

                    const cleanStdout = cleanupStdout(stdout);
                    const output: CheckovResponseRaw = JSON.parse(cleanStdout);
                    resolve(parseCheckovResponse(output, useBcIds));
                } catch (error) {
                    logger.error('Failed to get response from Checkov.', { error });
                    reject('Failed to get response from Checkov.');
                }
            });

            cancelToken.onCancellationRequested((cancelEvent) => {
                ckv.kill('SIGABRT');
                logger.info('Cancellation token invoked, aborting checkov run.', { cancelEvent });
            });
        });
    });
};

