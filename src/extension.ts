import * as vscode from 'vscode';
import { spawn } from "child_process";

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext) {

	const decorationType = vscode.window.createTextEditorDecorationType({
		borderWidth: '1px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		light: { // used in light color themes
			borderColor: 'darkblue'
		},
		dark: { // used in dark color themes
			borderColor: 'lightblue'
		},
		textDecoration: 'wavy underline'
	});

	let cmd = vscode.commands.registerCommand('checkov.scan-file', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		if (vscode.window.activeTextEditor) {
			runScan(vscode.window.activeTextEditor);
		}
		else {
			console.log('No active editor');
		}
	});

	function runScan(editor: vscode.TextEditor) {
		console.log('updateDecorations');

		let rangesToDecorate: vscode.DecorationOptions[] = [];
		console.log('running checkov');

		const ckv = spawn('checkov', ['-f', editor.document.fileName, '-o', 'json']);

		let stdout = '';

		ckv.stdout.on("data", data => {
			console.log(`stdout: ${data}`);
			stdout += data;
		});
		
		ckv.stderr.on("data", data => {
			console.log(`stderr: ${data}`);
		});
		
		ckv.on('error', (error) => {
			console.log(`error: ${error.message}`);
		});
		
		ckv.on("close", code => {
			console.log(`child process exited with code ${code}`);

			console.log(`task output: ${stdout}`);

			let output = JSON.parse(stdout);

			let failedChecks = output.results.failed_checks;

			for (const failure of failedChecks) {
				const startLine = failure.file_line_range[0];
				const line = editor.document.lineAt(startLine - 1);
				const startPos = line.range.start.translate(undefined, line.firstNonWhitespaceCharacterIndex);
				const decoration = {
					'range': new vscode.Range(startPos, line.range.end),
					'hoverMessage': `${failure.check_id}: ${failure.check_name}`
				};
				rangesToDecorate.push(decoration);
			}

			editor.setDecorations(decorationType, rangesToDecorate);
		});
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
