import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { Logger } from 'winston';

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

export const runCheckovScan = (logger: Logger, fileName: string, token: string, cancelToken: vscode.CancellationToken): Promise<CheckovResponse> => {
    return new Promise((resolve, reject) => {
        logger.info('Running checkov on', { fileName });
        const ckv = spawn('checkov', ['-s', '--skip-check', skipChecks.join(','), '--bc-api-key', token, '--repo-id', 'vscode/extension', '-f', fileName, '-o', 'json']);
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
