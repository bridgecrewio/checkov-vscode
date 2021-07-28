import * as vscode from 'vscode';
import { Logger } from 'winston';
import { setMissingConfigurationStatusBarItem } from './userInterface';

export const assureTokenSet = (logger: Logger, openConfigurationCommand: string): string | undefined => {
    // Read configuration
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const token = configuration.get<string>('token');
    if(!token) {
        logger.error('Bridgecrew API token was not found. Please add it to the configuration.');
        vscode.window.showErrorMessage('Bridgecrew API token was not found. Please add it to the configuration in order to scan your code.', 'Open configuration')
            .then(choice => choice === 'Open configuration' && vscode.commands.executeCommand(openConfigurationCommand));
        setMissingConfigurationStatusBarItem();
    }
    return token;
};

export const getPathToCert = (): string | undefined => {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const pathToCert = configuration.get<string>('certificate');
    return pathToCert;
};

export const getUseBcIds = (): boolean | undefined => {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const useBcIds = configuration.get<boolean>('useBridgecrewIDs', false);
    return useBcIds;
};

export const getAutoUpdate = (): boolean => {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const autoUpdate = configuration.get<boolean>('autoUpdateCheckov', false);
    return autoUpdate;
};

export const getCheckovVersion = (): string | undefined => {
    // do some normalization: trim, remove a leading 'v', return null instead of empty string
    // e.g., 'v2.0.123' => '2.0.123'; '' => null; ' ' => null

    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    let checkovVersion = configuration.get<string | undefined>('checkovVersion', undefined);

    if (!checkovVersion || !checkovVersion.trim()) {
        return undefined;
    }

    checkovVersion = checkovVersion.trim();
    if (checkovVersion.startsWith('v')) {
        checkovVersion = checkovVersion.substring(1);
    }

    return checkovVersion;
};
