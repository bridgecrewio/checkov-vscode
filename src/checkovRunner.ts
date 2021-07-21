import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import { Logger } from 'winston';
import { CheckovInstallation } from './checkovInstaller';
import { convertToUnixPath } from './utils';

export interface FailedCheckovCheck {
    checkId: string;
    checkName: string;
    fileLineRange: [number, number];
    resource: string;
    guideline: string;
    fixedDefinition?: string;
}

interface CheckovResponse {
    results: {
        failedChecks: FailedCheckovCheck[];
    };
}

interface FailedCheckovCheckRaw {
    check_id: string;
    bc_check_id: string | undefined;
    check_name: string;
    file_line_range: [number, number];
    resource: string;
    guideline: string;
    fixed_definition?: string;
}

interface CheckovResponseRaw {
    results: {
        failed_checks: FailedCheckovCheckRaw[];
    };
}

const dockerMountDir = '/checkovScan';
const configMountDir = '/checkovConfig';

const getDockerRunParams = (filePath: string, extensionVersion: string, configFilePath: string | null) => {
    return configFilePath ?
        ['run', '--rm', '--tty', '--env', 'BC_SOURCE=vscode', '--env', `BC_SOURCE_VERSION=${extensionVersion}`,
            '-v', `"${path.dirname(filePath)}:${dockerMountDir}"`, '-v', `"${path.dirname(configFilePath)}:${configMountDir}"`, 'bridgecrew/checkov',
            '--config-file', `${configMountDir}/${path.basename(configFilePath)}`] :
        ['run', '--rm', '--tty', '--env', 'BC_SOURCE=vscode', '--env', `BC_SOURCE_VERSION=${extensionVersion}`,
            '-v', `"${path.dirname(filePath)}:${dockerMountDir}"`, 'bridgecrew/checkov'];
};

const getpipRunParams = (configFilePath: string | null) => {
    return configFilePath ? ['--config-file', configFilePath] : [];
};

const cleanupStdout = (stdout: string) => stdout.replace(/.\[0m/g,''); // Clean docker run ANSI escapse chars

export const runCheckovScan = (logger: Logger, checkovInstallation: CheckovInstallation, extensionVersion: string, fileName: string, token: string, 
    certPath: string | undefined, useBcIds: boolean | undefined, cancelToken: vscode.CancellationToken, configPath: string | null): Promise<CheckovResponse> => {
    return new Promise((resolve, reject) => {   
        const { checkovInstallationMethod, checkovPath, workingDir } = checkovInstallation;

        const dockerRunParams = checkovInstallationMethod === 'docker' ? getDockerRunParams(fileName, extensionVersion, configPath) : [];
        const pipRunParams =  ['pipenv', 'pip3'].includes(checkovInstallationMethod) ? getpipRunParams(configPath) : [];
        const filePath = checkovInstallationMethod === 'docker' ? convertToUnixPath(path.join(dockerMountDir, path.basename(fileName))) : fileName;
        const certificateParams: string[] = certPath ? ['-ca', certPath] : [];
        const bcIdParam: string[] = useBcIds ? ['--output-bc-ids'] : [];
        const checkovArguments: string[] = [...dockerRunParams, ...certificateParams, ...bcIdParam, '-s', '--bc-api-key', token, '--repo-id', 
            'vscode/extension', '-f', `"${filePath}"`, '-o', 'json', ...pipRunParams];
        logger.info('Running checkov', { executablePath: checkovPath, arguments: checkovArguments.map(argument => argument === token ? '****' : argument) });
        const ckv = spawn(checkovPath, checkovArguments,
            {
                shell: true,
                env: { ...process.env, BC_SOURCE: 'vscode', BC_SOURCE_VERSION: extensionVersion },
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
                logger.debug('Checkov task output:', { stdout });
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
};

const parseCheckovResponse = (rawResponse: CheckovResponseRaw, useBcIds: boolean | undefined): CheckovResponse => {

    let failedChecks: FailedCheckovCheckRaw[];

    if (Array.isArray(rawResponse)) {
        failedChecks = rawResponse.reduce((res, val) => res.concat(val.results.failed_checks), []);
    }
    else {
        failedChecks = rawResponse.results.failed_checks;
    }

    return {
        results: {
            failedChecks: failedChecks.map(rawCheck => ({
                checkId: (useBcIds && rawCheck.bc_check_id) || rawCheck.check_id,
                checkName: rawCheck.check_name,
                fileLineRange: rawCheck.file_line_range,
                resource: rawCheck.resource,
                guideline: rawCheck.guideline,
                fixedDefinition: rawCheck.fixed_definition
            }))
        }
    };
};
