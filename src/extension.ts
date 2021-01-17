import * as vscode from 'vscode';
import { CheckovInstallation, installOrUpdateCheckov } from './checkovInstaller';
import { runCheckovScan, FailedCheckovCheck } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';
import { fixCodeActionProvider, providedCodeActionKinds } from './suggestFix';
import { createCheckovKey } from './utils';

export const OPEN_EXTERNAL_COMMAND = 'checkov.open-external';
export const RUN_FILE_SCAN_COMMAND = 'checkov.scan-file';
export const REMOVE_DIAGNOSTICS_COMMAND = 'checkov.remove-diagnostics';
const OPEN_CONFIGURATION_COMMAND = 'checkov.configuration.open';
const INSTALL_OR_UPDATE_CHECKOV_COMMAND = 'checkov.install-or-update-checkov';

export const CHECKOV_MAP = 'checkovMap';

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext): void {
    
    const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem();
    statusBarItem.command = OPEN_CONFIGURATION_COMMAND;
    statusBarItem.text = 'Checkov';
    statusBarItem.show();

    // Set diagnostics collection
    const diagnostics = vscode.languages.createDiagnosticCollection('checkov-alerts');
    context.subscriptions.push(diagnostics);

    const checkTokenIsSet = (): boolean => {
        // Read configuration 
        const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
        const token = configuration.get('token');
        if(!token) {
            vscode.window.showErrorMessage('Bridgecrew API token was not found. Please add it to the configuration.');
            statusBarItem.text = '$(gear) Checkov';
        }
        return !!token;
    };

    // install or update the checkov version 
    vscode.commands.registerCommand(INSTALL_OR_UPDATE_CHECKOV_COMMAND, async () => {
        try {
            statusBarItem.text = '$(sync~spin) Checkov';
            const environment: CheckovInstallation = await installOrUpdateCheckov();
            console.log(`finished installing checkov on ${environment.checkovPython} python environment.`);
            statusBarItem.text = 'Checkov';
        } catch(error) {
            console.error('Error occurred while trying to install Checkov', error);
            statusBarItem.text = '$(error) Checkov';
        }
    });
    vscode.commands.executeCommand(INSTALL_OR_UPDATE_CHECKOV_COMMAND);

    context.subscriptions.push(
        vscode.commands.registerCommand(OPEN_EXTERNAL_COMMAND, (uri: vscode.Uri) => vscode.env.openExternal(uri))
    );

    vscode.commands.registerCommand(RUN_FILE_SCAN_COMMAND, () => {
        if (!checkTokenIsSet()) return;

        if (vscode.window.activeTextEditor) {
            runScan(vscode.window.activeTextEditor);
        }
    });

    vscode.commands.registerCommand(REMOVE_DIAGNOSTICS_COMMAND, () => {
        if (vscode.window.activeTextEditor) 
            applyDiagnostics(vscode.window.activeTextEditor.document, diagnostics, []);
    });

    vscode.commands.registerCommand(OPEN_CONFIGURATION_COMMAND, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Bridgecrew.checkov');
    });

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
            // Indicate scan in status bar item
            statusBarItem.text = '$(sync~spin) Checkov';

            const checkovResponse = await runCheckovScan(editor.document.fileName);
            saveCheckovResult(checkovResponse.results.failedChecks);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failedChecks);

            statusBarItem.text = `$(${checkovResponse.results.failedChecks.length > 0 ? 'alert' : 'pass'}) Checkov`;
        } catch (error) {
            statusBarItem.text = '$(error) Checkov';
            console.error('Error occurred.', error);
            console.log('You can find the log file here', context.logUri.fsPath);
        }
    }
}
