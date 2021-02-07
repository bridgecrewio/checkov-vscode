import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import { Logger } from 'winston';
import { CheckovInstallation } from './checkovInstaller';

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

const skipChecks = ['CKV_AWS_52'];

const dockerMountDir = '/checkovScan';
const getDockerRunParams = (filePath: string, extensionVersion: string) => ['run', '--tty', '--env', 'BC_SOURCE=vscode', '--env', `BC_SOURCE_VERSION=${extensionVersion}`, '--volume', `${path.dirname(filePath)}:${dockerMountDir}`, 'bridgecrew/checkov'];

export const runCheckovScan = (logger: Logger, checkovInstallation: CheckovInstallation, extensionVersion: string, fileName: string, token: string, cancelToken: vscode.CancellationToken): Promise<CheckovResponse> => {
    return new Promise((resolve, reject) => {
        const { checkovInstallationMethod, checkovPath } = checkovInstallation;
        const [checkovExecutablePath, ...checkovInstallationParams] = checkovPath.split(' ');
        const dockerRunParams = checkovInstallationMethod === 'docker' ? getDockerRunParams(fileName, extensionVersion) : [];
        const filePath = checkovInstallationMethod === 'docker' ? path.join(dockerMountDir, path.basename(fileName)) : fileName;
        const checkovArguments: string[] = [...checkovInstallationParams, ...dockerRunParams, '-s', '--skip-check', skipChecks.join(','), '--bc-api-key', token, '--repo-id', 'vscode/extension', '-f', `"${filePath}"`, '-o', 'json'];
        logger.info('Running checkov', { executablePath: checkovExecutablePath, arguments: checkovArguments.map(argument => argument === token ? '****' : argument) });
        const ckv = spawn(checkovPath, checkovArguments, 
            {
                shell: true,
                env: { ...process.env, BC_SOURCE: 'vscode', BC_SOURCE_VERSION: extensionVersion }
            });
        let stdout = '';
	
        ckv.stdout.on('data', data => {
            stdout += data;
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
                if (code !== 0) return reject(`Checkov exited with code ${code}`);
                
                if (stdout.startsWith('[]')) {
                    logger.debug('Got an empty reply from checkov', { reply: stdout, fileName });
                    return resolve({ results: { failedChecks: [] } });
                }

                const output: CheckovResponseRaw = JSON.parse(stdout);
                logger.debug('Checkov task output:', output);
                resolve(parseCheckovResponse(output));
            } catch (err) {
                reject('Failed to get response from Checkov.');
            }
        });

        cancelToken.onCancellationRequested((cancelEvent) => {
            ckv.kill('SIGABRT');
            logger.info('Cancellation token invoked, aborting checkov run', { cancelEvent });
        });
    });
};

const parseCheckovResponse = (rawResponse: CheckovResponseRaw): CheckovResponse => {
    return {
        results: {
            failedChecks: rawResponse.results.failed_checks.map(rawCheck => ({ 
                checkId: rawCheck.check_id, 
                checkName: rawCheck.check_name, 
                fileLineRange: rawCheck.file_line_range,
                resource: rawCheck.resource, 
                guideline: rawCheck.guideline,
                fixedDefinition: rawCheck.fixed_definition
            }))
        }
    };
};
