import * as vscode from 'vscode';
import { CheckovInstalltion, installOrUpdateCheckov } from './checkovInstaller';
import { runCheckovScan } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';

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

    // Set diagnostics collection
    const diagnostics = vscode.languages.createDiagnosticCollection('bridgecrew-alerts');
    context.subscriptions.push(diagnostics);

    vscode.commands.registerCommand('checkov.scan-file', () => {
        
        if (vscode.window.activeTextEditor) {
            runScan(vscode.window.activeTextEditor);
        }
        else {
            console.warn('No active editor.');
        }
    });

    async function runScan(editor: vscode.TextEditor) {
        console.log('Starting to scan.');
        try {
            const checkovResponse = await runCheckovScan(editor.document.fileName);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failedChecks);
        } catch (error) {
            console.error('Error occurred.', error);
        }
    }
}
