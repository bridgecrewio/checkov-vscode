import * as vscode from 'vscode';
import { runCheckovScan } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext): void {
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
            const checkovResponse = await runCheckovScan(editor.document.fileName);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failed_checks);
        } catch (error) {
            console.error('Error occurred.', error);
        }
    }
}
