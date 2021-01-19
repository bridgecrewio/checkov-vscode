import * as vscode from 'vscode';
import { Logger } from 'winston';
import { setMissingConfigurationStatusBarItem } from './userInterface';

export const assureTokenSet = (logger: Logger, openConfigurationCommand: string): string | undefined => {
    // Read configuration 
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const token = configuration.get<string>('token');
    if(!token) {
        logger.error('Bridgecrew API token was not found. Please add it to the configuration.');
        vscode.window.showErrorMessage('Bridgecrew API token was not found. Please add it to the configuration.', 'Open configuration')
            .then(choice => choice === 'Open configuration' && vscode.commands.executeCommand(openConfigurationCommand));
        setMissingConfigurationStatusBarItem();
    }
    return token;
};
