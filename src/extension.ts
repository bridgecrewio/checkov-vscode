import * as vscode from 'vscode';
import { TextEncoder } from 'util';
import debounce from 'lodash/debounce';
import { Logger } from 'winston';
import { CheckovInstallation, installOrUpdateCheckov } from './checkovInstaller';
import { runCheckovScan } from './checkovRunner';
import { applyDiagnostics } from './diagnostics';
import { fixCodeActionProvider, providedCodeActionKinds } from './suggestFix';
import { getLogger, saveCheckovResult, isSupportedFileType, extensionVersion } from './utils';
import { initializeStatusBarItem, setErrorStatusBarItem, setPassedStatusBarItem, setReadyStatusBarItem, setSyncingStatusBarItem, showContactUsDetails } from './userInterface';
import { assureTokenSet, getPathToCert } from './configuration';
import { INSTALL_OR_UPDATE_CHECKOV_COMMAND, OPEN_CONFIGURATION_COMMAND, OPEN_EXTERNAL_COMMAND, REMOVE_DIAGNOSTICS_COMMAND, RUN_FILE_SCAN_COMMAND } from './commands';
import { getConfigFilePath } from './parseCheckovConfig';

export const CHECKOV_MAP = 'checkovMap';
const logFileName = 'checkov.log';
const tempScanFile = 'temp.tf';

// this method is called when extension is activated
export function activate(context: vscode.ExtensionContext): void {
    const logger: Logger = getLogger(context.logUri.fsPath, logFileName);
    logger.info('Starting Checkov Extension.', { extensionVersion, vscodeVersion: vscode.version });

    initializeStatusBarItem(OPEN_CONFIGURATION_COMMAND);
    let extensionReady = false;
    let checkovRunCancelTokenSource = new vscode.CancellationTokenSource();
    let checkovInstallation : CheckovInstallation | null = null;
    const checkovInstallationDir = vscode.Uri.joinPath(context.globalStorageUri, 'checkov-installation').fsPath;

    const resetCancelTokenSource = () => {
        checkovRunCancelTokenSource.cancel();
        checkovRunCancelTokenSource.dispose();
        checkovRunCancelTokenSource = new vscode.CancellationTokenSource();
    };

    // Set diagnostics collection
    const diagnostics = vscode.languages.createDiagnosticCollection('checkov-alerts');
    context.subscriptions.push(diagnostics);

    // Set commands
    context.subscriptions.push(
        vscode.commands.registerCommand(INSTALL_OR_UPDATE_CHECKOV_COMMAND, async () => {
            try {
                extensionReady = false;
                setSyncingStatusBarItem('Updating Checkov');
                checkovInstallation = await installOrUpdateCheckov(logger, checkovInstallationDir);
                logger.info(`Finished installing Checkov with ${checkovInstallation.checkovInstallationMethod}.` , { checkovPath: checkovInstallation.checkovPath });
                setReadyStatusBarItem();
                extensionReady = true;
                if (vscode.window.activeTextEditor && isSupportedFileType(vscode.window.activeTextEditor.document.fileName))
                    vscode.commands.executeCommand(RUN_FILE_SCAN_COMMAND);
            } catch(error) {
                setErrorStatusBarItem();
                logger.error('Error occurred while preparing Checkov. try to reload vscode.', { error });
                showContactUsDetails(context.logUri, logFileName);
            }
        }),
        vscode.commands.registerCommand(RUN_FILE_SCAN_COMMAND, async (fileUri?: vscode.Uri): Promise<void> => {
            if (!extensionReady) {
                logger.warn('Tried to scan before checkov finished installing or updating. Please wait a few seconds and try again.');
                vscode.window.showWarningMessage('Still installing/updating Checkov, please wait a few seconds and try again.', 'Got it');
                return;
            }
            resetCancelTokenSource();
            const token = assureTokenSet(logger, OPEN_CONFIGURATION_COMMAND);
            const certPath = getPathToCert();
            vscode.commands.executeCommand(REMOVE_DIAGNOSTICS_COMMAND);
            if (!fileUri && vscode.window.activeTextEditor && !isSupportedFileType(vscode.window.activeTextEditor.document.fileName, true))
                return;
            if (!!token && vscode.window.activeTextEditor) {
                await runScan(vscode.window.activeTextEditor, token, certPath, checkovRunCancelTokenSource.token, fileUri);
            }
        }),
        vscode.commands.registerCommand(REMOVE_DIAGNOSTICS_COMMAND, () => {
            if (vscode.window.activeTextEditor) {
                setReadyStatusBarItem();
                applyDiagnostics(vscode.window.activeTextEditor.document, diagnostics, []);
            }
        }),
        vscode.commands.registerCommand(OPEN_CONFIGURATION_COMMAND, () => {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Bridgecrew.checkov');
        }),
        vscode.commands.registerCommand(OPEN_EXTERNAL_COMMAND, (uri: vscode.Uri) => vscode.env.openExternal(uri))
    );

    vscode.commands.executeCommand(INSTALL_OR_UPDATE_CHECKOV_COMMAND);

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(changeEvent => {
            if (!extensionReady) return;
            if ((vscode.window.activeTextEditor &&
                changeEvent.document.uri.toString() !== vscode.window.activeTextEditor.document.uri.toString())
                || !isSupportedFileType(changeEvent.document.fileName))
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
        }),
        vscode.workspace.onDidSaveTextDocument(saveEvent => {
            if (!extensionReady) return;
            if ((vscode.window.activeTextEditor && saveEvent.uri.toString() !== vscode.window.activeTextEditor.document.uri.toString())
                || !isSupportedFileType(saveEvent.fileName)) {
                setReadyStatusBarItem();
                return;
            }
            vscode.commands.executeCommand(RUN_FILE_SCAN_COMMAND);
        }),
        vscode.window.onDidChangeActiveTextEditor(changeViewEvent => {
            if (!extensionReady) return;
            if (changeViewEvent && !isSupportedFileType(changeViewEvent.document.fileName)) {
                resetCancelTokenSource();
                setReadyStatusBarItem();
                return;
            }
            vscode.commands.executeCommand(RUN_FILE_SCAN_COMMAND);
        })
    );

    // set code action provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider([{ pattern: ' **/*.{tf,yml,yaml,json}' },{ pattern: '**/Dockerfile' }],
            fixCodeActionProvider(context.workspaceState), { providedCodeActionKinds: providedCodeActionKinds })
    );

    const runScan = debounce(async (editor: vscode.TextEditor, token: string, certPath: string | undefined, cancelToken: vscode.CancellationToken, fileUri?: vscode.Uri): Promise<void> => {
        logger.info('Starting to scan.');
        try {
            setSyncingStatusBarItem('Checkov scanning');
            const filePath = fileUri ? fileUri.fsPath : editor.document.fileName;
            const configPath = getConfigFilePath();

            if (!checkovInstallation) {
                logger.error('Checkov is not installed, aborting scan.');
                return;
            }

            const checkovResponse = await runCheckovScan(logger, checkovInstallation, extensionVersion, filePath, token, certPath, cancelToken, configPath);
            saveCheckovResult(context.workspaceState, checkovResponse.results.failedChecks);
            applyDiagnostics(editor.document, diagnostics, checkovResponse.results.failedChecks);
            checkovResponse.results.failedChecks.length > 0 ? setErrorStatusBarItem() : setPassedStatusBarItem();
        } catch (error) {
            if (cancelToken.isCancellationRequested) {
                return;
            }

            setErrorStatusBarItem();
            logger.error('Error occurred while running a checkov scan', { error });
            showContactUsDetails(context.logUri, logFileName);
        }
    }, 300, {});
}
