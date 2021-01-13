import * as vscode from 'vscode';
import { CheckovInstalltion, installOrUpdateCheckov } from './checkovInstaller';
import { runCheckovScan, FailedCheckovCheck } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';
import { fixCodeActionProvider, providedCodeActionKinds } from './suggestFix';
import { createCheckovKey } from './utils';

export const OPEN_EXTERNAL_COMMAND = 'checkov.open-external';
export const RUN_FILE_SCAN_COMMAND = 'checkov.scan-file';
export const REMOVE_DIAGNOSTICS_COMMAND = 'checkov.remove-diagnostics';
export const CHECKOV_MAP = 'checkovMap';

const INSTALL_OR_UPDATE_COMMAND = 'checkov.install-or-update-checkov';

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext): void {
    // install or update the checkov version 
    vscode.commands.registerCommand(INSTALL_OR_UPDATE_COMMAND, async () => {
        try {
            const environment: CheckovInstalltion = await installOrUpdateCheckov();
            console.log(`finished installing checkov on ${environment.checkovPython} python environment.`);
        } catch(error) {
            console.error('Error occurred while trying to install Checkov', error);
        }
    });
    vscode.commands.executeCommand(INSTALL_OR_UPDATE_COMMAND);

    context.subscriptions.push(
        vscode.commands.registerCommand(OPEN_EXTERNAL_COMMAND, (uri: vscode.Uri) => vscode.env.openExternal(uri))
    );

    vscode.commands.registerCommand(RUN_FILE_SCAN_COMMAND, () => {
        
        if (vscode.window.activeTextEditor) {
            runScan(vscode.window.activeTextEditor);
        }
        else {
            console.warn('No active editor.');
        }
    });

    vscode.commands.registerCommand(REMOVE_DIAGNOSTICS_COMMAND, () => {
        if (vscode.window.activeTextEditor) 
            applyDiagnostics(vscode.window.activeTextEditor.document, diagnostics, []);
    });

    // Set diagnostics
    const diagnostics = vscode.languages.createDiagnosticCollection('checkov-alerts');
    context.subscriptions.push(diagnostics);

    // set code action provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider({ pattern: ' **/*.tf' }, 
            fixCodeActionProvider(context.workspaceState), { providedCodeActionKinds: providedCodeActionKinds })
    );
    
    const saveCheckovResult = (checkovFails: FailedCheckovCheck[]) => {
        const checkovMap = checkovFails.reduce((prev, current) => ({
            ...prev,
            [createCheckovKey(current)]: current
        }), []);
        context.workspaceState.update(CHECKOV_MAP, checkovMap);
    };    

    async function runScan(editor: vscode.TextEditor) {
        console.log('Starting to scan.');
        try {
            const checkovResponse = await runCheckovScan(editor.document.fileName);
            saveCheckovResult(checkovResponse.results.failedChecks);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failedChecks);
        } catch (error) {
            console.error('Error occurred.', error);
        }
    }
}
