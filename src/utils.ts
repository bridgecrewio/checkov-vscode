import * as vscode from 'vscode';
import { exec, ExecOptions } from 'child_process';
import winston from 'winston';
import { FailedCheckovCheck } from './checkovRunner';
import { DiagnosticReferenceCode } from './diagnostics';
import { CHECKOV_MAP } from './extension';
import { showUnsupportedFileMessage } from './userInterface';

const extensionData = vscode.extensions.getExtension('bridgecrew.checkov');
export const extensionVersion = extensionData ? extensionData.packageJSON.version : 'unknown';

type ExecOutput = [stdout: string, stderr: string];
export const asyncExec = async (commandToExecute: string, options: ExecOptions = {}): Promise<ExecOutput> => {
    const defaultOptions: ExecOptions = { maxBuffer: 1024 * 1000 };
    return new Promise((resolve, reject) => {
        exec(commandToExecute, { ...defaultOptions, ...options }, (err, stdout, stderr) => {
            if (err) { return reject(err); }
            resolve([stdout, stderr]);
        });
    });
};

export const isSupportedFileType = (fileName: string, showMessage = false): boolean => {
    if (!(fileName.endsWith('.tf') || fileName.endsWith('.yml') || fileName.endsWith('.yaml') || fileName.endsWith('.json') || fileName.match('Dockerfile'))) {
        showMessage && showUnsupportedFileMessage();
        return false;
    }
    return true;
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
        winston.format.splat(),
        winston.format.printf(({ level, message, ...rest }) => {
            const logError = rest.error && rest.error instanceof Error ? { error: { ...rest.error, message: rest.error.message, stack: rest.error.stack } } : {};
            const argumentsString = JSON.stringify({ ...rest, ...logError });
            return `[${level}]: ${message} ${argumentsString !== '{}' ? argumentsString : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({
            level: 'debug',
            dirname: logFileDir,
            filename: logFileName
        })
    ]
});

export const convertToUnixPath = (path: string): string => {
    const isExtendedLengthPath = /^\\\\\?\\/.test(path);
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\u0000-\u0080]+/.test(path);

    if (isExtendedLengthPath || hasNonAscii) {
        return path;
    }

    return path.replace(/\\/g, '/');
};

export const getWorkspacePath = (logger: winston.Logger): string | void => {
    if(vscode.workspace) {
        if(vscode.workspace.workspaceFolders) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            logger.warn('No folder open in workspace.');
        }
    } 
    logger.warn('No workspace open.');
    return;
};

