import {exec} from 'child_process';

type ExecOutput = [stdout: string, stderr: string];
export const asyncExec = async <T>(commandToExecute: string) : Promise<ExecOutput> => {
    return new Promise((resolve, reject) => {
        exec(commandToExecute, (err, stdout, stderr) => {
            if (err) {return reject(err);}
            resolve([stdout, stderr]);
        });
    });
}; 