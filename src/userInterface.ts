import * as vscode from 'vscode';
import { extensionVersion } from './utils';

export const showContactUsDetails = (logDirectoryPath: vscode.Uri, logFileName: string): void => {
    const contactUsMessage = 'Any troubles? We can help you figure out what happened';

    vscode.window.showInformationMessage(contactUsMessage, 'Open log', 'Open issue', 'Slack us')
        .then(choice => {
            if (!choice) return;

            if (choice === 'Open log') {
                vscode.window.showTextDocument(vscode.Uri.joinPath(logDirectoryPath, logFileName));
                return;
            }

            const uri =
                choice === 'Open issue' ? vscode.Uri.parse('https://github.com/bridgecrewio/checkov-vscode')
                    : vscode.Uri.parse('https://slack.bridgecrew.io');

            vscode.env.openExternal(uri);
        });
};

export const showUnsupportedFileMessage = (): void => {
    const message = 'Unsupported file type for Checkov scanning, We support [Dockerfile, .tf, .yml, .yaml, .json] files only.';
    vscode.window.showWarningMessage(message);
};

export const showAboutCheckovMessage = async (version: string, installationMethod: string): Promise<void> => {
    const message = `Checkov CLI version: ${version}; Installation method: ${installationMethod}; Extension version: ${extensionVersion}`;
    vscode.window.showInformationMessage(message);
};

export const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem();

export const initializeStatusBarItem = (onClickCommand: string): void  => {
    statusBarItem.command = onClickCommand;
    statusBarItem.text = 'Checkov';
    statusBarItem.show();
};

export const setReadyStatusBarItem = (version: string | undefined): void => {
    statusBarItem.text = getStatusBarText('gear', version);
};

export const setMissingConfigurationStatusBarItem = (version: string | undefined): void => {
    statusBarItem.text = getStatusBarText('exclude', version);
};

export const setSyncingStatusBarItem = (version: string | undefined, text = 'Checkov'): void => {
    statusBarItem.text = getStatusBarText('sync~spin', version, text);
};

export const setErrorStatusBarItem = (version: string | undefined): void => {
    statusBarItem.text = getStatusBarText('error', version);
};

export const setPassedStatusBarItem = (version: string | undefined): void => {
    statusBarItem.text = getStatusBarText('pass', version);
};

const getStatusBarText = (icon: string | undefined, version: string | undefined, text = 'Checkov'): string => {
    return `${icon ? `$(${icon}) ` : ''}${text}${version ? ` - v${version}` : ''}`;
};
