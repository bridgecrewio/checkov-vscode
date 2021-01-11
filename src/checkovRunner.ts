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

export const runCheckovScan = (fileName: string, failedHandler: (checks: FailedCheckovCheck[]) => void): void => {
		console.log('Running checkov on', fileName);
		const ckv = spawn('checkov', ['-f', fileName, '-o', 'json']);
		let stdout = '';

		ckv.stdout.on("data", data => {
			stdout += data;
		});
		
		ckv.stderr.on("data", data => {
			console.warn(`stderr: ${data}`);
		});
		
		ckv.on('error', (error) => {
			console.error('Error while running Checkov', error);
		});
		
		ckv.on("close", code => {
			console.debug(`child process exited with code ${code}`);

            console.debug(`task output: ${stdout}`);
            const output: CheckovResponse = JSON.parse(stdout);

            failedHandler(output.results.failed_checks);
        });
};
