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
