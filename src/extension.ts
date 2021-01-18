import * as vscode from 'vscode';
import { TextEncoder } from 'util';
import { Logger } from 'winston';
import { CheckovInstallation, installOrUpdateCheckov } from './checkovInstaller';
import { runCheckovScan, FailedCheckovCheck } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';
import { fixCodeActionProvider, providedCodeActionKinds } from './suggestFix';
import { createCheckovKey, getLogger } from './utils';

export const OPEN_EXTERNAL_COMMAND = 'checkov.open-external';
export const RUN_FILE_SCAN_COMMAND = 'checkov.scan-file';
export const REMOVE_DIAGNOSTICS_COMMAND = 'checkov.remove-diagnostics';
const OPEN_CONFIGURATION_COMMAND = 'checkov.configuration.open';
const INSTALL_OR_UPDATE_CHECKOV_COMMAND = 'checkov.install-or-update-checkov';

export const CHECKOV_MAP = 'checkovMap';
const logFileName = 'checkov.log';
const tempScanFile = 'temp.tf';

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext): void {
    const logger: Logger = getLogger(context.logUri.fsPath, logFileName);
    
    const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem();
    statusBarItem.command = OPEN_CONFIGURATION_COMMAND;
    statusBarItem.text = 'Checkov';
    statusBarItem.show();
    
    let checkovInstalled = false;
    let checkovRunCancelTokenSource = new vscode.CancellationTokenSource();

    const resetCancelTokenSource = () => {
        checkovRunCancelTokenSource.cancel();
        checkovRunCancelTokenSource.dispose();
        checkovRunCancelTokenSource = new vscode.CancellationTokenSource();
    };

    const showContactUsDetails = (): void => {
        const contactUsMessage = `
Any troubles? We can help you figure out what happened.
Open an issue on https://github.com/bridgecrewio/checkov-vscode
Or contact us directly on https://slack.bridgecrew.io .
Adding the log file will be very useful,
You can find it here:
${context.logUri.fsPath}`;
        
        vscode.window.showInformationMessage(contactUsMessage, 'Open log', 'Open issue', 'Slack us')
            .then(choice => {
                if (!choice) return;
                
                if (choice === 'Open log') {
                    vscode.window.showTextDocument(vscode.Uri.joinPath(context.logUri, logFileName));
                    return;
                }

                const uri = 
                    choice === 'Open issue' ? vscode.Uri.parse('https://github.com/bridgecrewio/checkov-vscode') 
                        : vscode.Uri.parse('https://slack.bridgecrew.io');
                
                vscode.env.openExternal(uri);
            });
    };

    // Set diagnostics collection
    const diagnostics = vscode.languages.createDiagnosticCollection('checkov-alerts');
    context.subscriptions.push(diagnostics);

    const checkTokenIsSet = (): string | undefined => {
        // Read configuration 
        const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
        const token = configuration.get<string>('token');
        if(!token) {
            logger.error('Bridgecrew API token was not found. Please add it to the configuration.');
            vscode.window.showErrorMessage('Bridgecrew API token was not found. Please add it to the configuration.', 'Open configuration')
                .then(choice => choice === 'Open configuration' && vscode.commands.executeCommand(OPEN_CONFIGURATION_COMMAND));
            statusBarItem.text = '$(gear) Checkov';
        }
        return token;
    };

    // install or update the checkov version 
    vscode.commands.registerCommand(INSTALL_OR_UPDATE_CHECKOV_COMMAND, async () => {
        try {
            statusBarItem.text = '$(sync~spin) Checkov';
            const environment: CheckovInstallation = await installOrUpdateCheckov(logger);
            logger.info(`finished installing checkov on ${environment.checkovPython} python environment.`);
            statusBarItem.text = 'Checkov';
            checkovInstalled = true;
        } catch(error) {
            statusBarItem.text = '$(error) Checkov';
            logger.error('Error occurred while trying to install Checkov', { error });
            showContactUsDetails();
        }
    });
    vscode.commands.executeCommand(INSTALL_OR_UPDATE_CHECKOV_COMMAND);

    context.subscriptions.push(
        vscode.commands.registerCommand(OPEN_EXTERNAL_COMMAND, (uri: vscode.Uri) => vscode.env.openExternal(uri))
    );

    vscode.workspace.onDidChangeTextDocument(changeEvent => {
        if (vscode.window.activeTextEditor && changeEvent.document.uri.toString() !== vscode.window.activeTextEditor.document.uri.toString()) 
            return;
        vscode.commands.executeCommand(REMOVE_DIAGNOSTICS_COMMAND);
        
        // Run scan on enter (new line)
        if (!changeEvent.contentChanges.some(change => change.text.includes('\n'))) return;

        const tempFileUri: vscode.Uri = vscode.Uri.joinPath(context.globalStorageUri, tempScanFile);
        const text: string = changeEvent.document.getText();
        const stringBuffer: Uint8Array = new TextEncoder().encode(text);

        // Save changes in temp file
        vscode.workspace.fs.writeFile(tempFileUri, stringBuffer)
            .then(() => {
                logger.debug('Saved temporary file, now scanning', { tempFile: tempFileUri.fsPath });
                vscode.commands.executeCommand(RUN_FILE_SCAN_COMMAND, tempFileUri);
            }, error => {
                logger.error('Error occurred trying to save temp file', { error });
            });
    });

    vscode.workspace.onDidSaveTextDocument(saveEvent => {
        if (vscode.window.activeTextEditor && saveEvent.uri.toString() !== vscode.window.activeTextEditor.document.uri.toString()) 
            return;
        vscode.commands.executeCommand(RUN_FILE_SCAN_COMMAND);
    });

    vscode.window.onDidChangeActiveTextEditor(changeViewEvent => {
        vscode.commands.executeCommand(RUN_FILE_SCAN_COMMAND);
    });

    vscode.commands.registerCommand(RUN_FILE_SCAN_COMMAND, async (fileUri?: vscode.Uri): Promise<void> => {
        if (!checkovInstalled) {
            logger.warn('Tried to scan before checkov finished installing or updating. Please wait a few seconds and try again.');
            vscode.window.showWarningMessage('Still installing/updating Checkov, please wait a few seconds and try again.', 'Got it');
            return;
        }
        resetCancelTokenSource();
        const token = checkTokenIsSet();
        vscode.commands.executeCommand(REMOVE_DIAGNOSTICS_COMMAND);
        if (!!token && vscode.window.activeTextEditor) {
            await runScan(vscode.window.activeTextEditor, token, checkovRunCancelTokenSource.token, fileUri);
        }
    });

    vscode.commands.registerCommand(REMOVE_DIAGNOSTICS_COMMAND, () => {
        if (vscode.window.activeTextEditor) {
            statusBarItem.text = 'Checkov';
            applyDiagnostics(vscode.window.activeTextEditor.document, diagnostics, []);
        }
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
    
    async function runScan(editor: vscode.TextEditor,  token: string, cancelToken: vscode.CancellationToken, fileUri?: vscode.Uri) {
        logger.info('Starting to scan.');
        try {
            // Indicate scan in status bar item
            statusBarItem.text = '$(sync~spin) Checkov';

            const checkovResponse = await runCheckovScan(logger, fileUri ? fileUri.fsPath : editor.document.fileName, token, cancelToken);
            saveCheckovResult(checkovResponse.results.failedChecks);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failedChecks);

            statusBarItem.text = `$(${checkovResponse.results.failedChecks.length > 0 ? 'error' : 'pass'}) Checkov`;
        } catch (error) {
            if (cancelToken.isCancellationRequested) {
                statusBarItem.text = 'Checkov';
                return;
            }
            
            statusBarItem.text = '$(error) Checkov';
            logger.error('Error occurred while running a checkov scan', { error });
            showContactUsDetails();
        }
    }
}
