import * as vscode from 'vscode';
import { exec } from 'child_process';
import { FailedCheckovCheck } from './checkovRunner';

type ExecOutput = [stdout: string, stderr: string];
export const asyncExec = async (commandToExecute: string) : Promise<ExecOutput> => {
    return new Promise((resolve, reject) => {
        exec(commandToExecute, (err, stdout, stderr) => {
            if (err) {return reject(err);}
            resolve([stdout, stderr]);
        });
    });
}; 

export const createDiagnosticKey = (diagnostic: vscode.Diagnostic): string => `${(diagnostic.code as {
    value: string | number;
    target: vscode.Uri;
}).value}-${diagnostic.range.start.line + 1}`;
export const createCheckovKey = (checkovFail: FailedCheckovCheck): string => `${checkovFail.checkId}-${checkovFail.fileLineRange[0]}`;
