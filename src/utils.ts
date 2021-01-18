import * as vscode from 'vscode';
import { exec } from 'child_process';
import { FailedCheckovCheck } from './checkovRunner';
import { DiagnosticReferenceCode } from './diagnostics';
import winston = require('winston');
import { CHECKOV_MAP } from './extension';

type ExecOutput = [stdout: string, stderr: string];
export const asyncExec = async (commandToExecute: string) : Promise<ExecOutput> => {
    return new Promise((resolve, reject) => {
        exec(commandToExecute, (err, stdout, stderr) => {
            if (err) {return reject(err);}
            resolve([stdout, stderr]);
        });
    });
}; 

export const saveCheckovResult = (state: vscode.Memento, checkovFails: FailedCheckovCheck[]): void => {
    const checkovMap = checkovFails.reduce((prev, current) => ({
        ...prev,
        [createCheckovKey(current)]: current
    }), []);
    state.update(CHECKOV_MAP, checkovMap);
};

export const createDiagnosticKey = (diagnostic: vscode.Diagnostic): string => 
    `${(diagnostic.code as DiagnosticReferenceCode).value}-${diagnostic.range.start.line + 1}`;
export const createCheckovKey = (checkovFail: FailedCheckovCheck): string => `${checkovFail.checkId}-${checkovFail.fileLineRange[0]}`;

export const getLogger = (logFileDir: string, logFileName: string): winston.Logger => winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.simple(),
        winston.format.timestamp()
    ),
    transports: [
        new winston.transports.File({
            level: 'debug',
            dirname: logFileDir,
            filename: logFileName
        })
    ]
});
