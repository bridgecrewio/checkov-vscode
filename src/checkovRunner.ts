import { spawn } from "child_process";

export interface FailedCheckovCheck {
    "check_id": string;
    "check_name": string;
    file_line_range: [number, number];
    resource: string;
}

interface CheckovResponse {
    results: {
        failed_checks: FailedCheckovCheck[];
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
            if (code !== 0) return reject(`Checkov exited with code ${code}`);
	
            console.debug(`Checkov task output: ${stdout}`);
            const output: CheckovResponse = JSON.parse(stdout);
	
            resolve(output);
        });
    });
};
