import { spawn } from "child_process";

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

export const runCheckovScan = (fileName: string): Promise<CheckovResponse> => {
    return new Promise((resolve, reject) => {
        console.log('Running checkov on', fileName);
        const ckv = spawn('checkov', ['-f', fileName, '-o', 'json']);
        let stdout = '';
	
        ckv.stdout.on("data", data => {
            stdout += data;
        });
			
        ckv.stderr.on("data", data => {
            console.warn(`Checkov stderr: ${data}`);
        });
			
        ckv.on('error', (error) => {
            console.error('Error while running Checkov', error);
        });
			
        ckv.on("close", code => {
            console.debug(`Checkov scan process exited with code ${code}`);
            if (code !== 1) return reject(`Checkov exited with code ${code}`); // Check about checkov
	
            console.debug(`Checkov task output: ${stdout}`);
            const output: CheckovResponseRaw = JSON.parse(stdout);
	
            resolve(parseCheckovResponse(output));
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
