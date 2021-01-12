import * as vscode from 'vscode';
import { runCheckovScan } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext): void {
    // Read configuration 
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('bridgecrew');
    const token = configuration.get('token');
    if(!token) {
        vscode.window.showErrorMessage('Bridgecrew API token was not found. Please add it to the configuration.');
        vscode.window.setStatusBarMessage('$(gear) Bridgecrew');
    }

    // Display a status bar item
    const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem();
    statusBarItem.command = '';
    vscode.window.setStatusBarMessage('$(check) Bridgecrew');

    // Set diagnostics
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
            // Indicate scan in status bar item
            vscode.window.setStatusBarMessage('$(sync~spin) Bridgecrew');

            const checkovResponse = await runCheckovScan(editor.document.fileName);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failedChecks);

            vscode.window.setStatusBarMessage(`$(${checkovResponse.results.failedChecks.length > 0 ? 'alert' : 'pass'}) Bridgecrew`);
        } catch (error) {
            vscode.window.setStatusBarMessage('$(error) Bridgecrew');
            console.error('Error occurred.', error);
            console.log('You can find the log file here', context.logUri.fsPath);
        }
    }
}
