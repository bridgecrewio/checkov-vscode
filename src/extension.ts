import * as vscode from 'vscode';
import { partial } from 'ramda';
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
			console.log('No active editor');
		}
	});

	function runScan(editor: vscode.TextEditor) {
		console.log('Starting to scan');
		const handleFailedCheck = partial(applyDiagnostics, [editor.document, diagnostics]);
		
		runCheckovScan(editor.document.fileName, handleFailedCheck);
	}
}
