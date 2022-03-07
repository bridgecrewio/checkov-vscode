import * as vscode from 'vscode';
import { Logger } from 'winston';
import { setMissingConfigurationStatusBarItem } from './userInterface';
import * as semver from 'semver';
import { CheckovInstallation } from './checkovInstaller';
import { getTokenType } from './utils';
import { asyncExec } from './utils';

const minCheckovVersion = '2.0.0';
const minPythonVersion = '3.7.0';

export const assureTokenSet = (logger: Logger, openConfigurationCommand: string, checkovInstallation: CheckovInstallation | null): string | undefined => {
    // Read configuration
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const token = configuration.get<string>('token');
    if (!token) {
        logger.error('Bridgecrew API token was not found. Please add it to the configuration.');
        vscode.window.showErrorMessage('Bridgecrew API token was not found. Please add it to the configuration in order to scan your code.', 'Open configuration')
            .then(choice => choice === 'Open configuration' && vscode.commands.executeCommand(openConfigurationCommand));
        setMissingConfigurationStatusBarItem(checkovInstallation?.version);
    } else {
        const tokenType = getTokenType(token);
        logger.debug(`Token type: ${tokenType}`);
        if (!tokenType) {
            logger.error('API token does not appear to be a valid Bridgecrew or Prisma API key. Please verify the value and try again.');
            vscode.window.showErrorMessage('API token does not appear to be a valid Bridgecrew or Prisma API key. Please verify the value and try again.', 'Open configuration')
                .then(choice => choice === 'Open configuration' && vscode.commands.executeCommand(openConfigurationCommand));
            setMissingConfigurationStatusBarItem(checkovInstallation?.version);
        } else if (tokenType === 'prisma' && !getPrismaUrl()) {
            logger.error('Prisma token was identified but no Prisma URL was found');
            vscode.window.showErrorMessage('Prisma token was identified but no Prisma URL was found. In order to authenticate with your app you must provide Prisma URL', 'Open configuration')
                .then(choice => choice === 'Open configuration' && vscode.commands.executeCommand(openConfigurationCommand));
            setMissingConfigurationStatusBarItem(checkovInstallation?.version);
        }
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

export const getUseDebugLogs = (): boolean | undefined => {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const useDebugLogs = configuration.get<boolean>('useDebugLogs', false);
    return useDebugLogs;
};

export const getCheckovVersion = (): string => {

    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const checkovVersion = configuration.get<string>('checkovVersion', 'latest').trim().toLowerCase();

    if (checkovVersion === '' || checkovVersion === 'latest') {
        return 'latest';
    } else {
        if (!semver.valid(checkovVersion)) {
            throw Error(`Invalid checkov version: ${checkovVersion}`);
        }
        
        const clean = semver.clean(checkovVersion);
        if (!clean) {
            throw Error(`Invalid checkov version: ${checkovVersion}`);
        }

        if (!semver.satisfies(checkovVersion, `>=${minCheckovVersion}`)) {
            throw Error(`Invalid checkov version: ${checkovVersion} (must be >=${minCheckovVersion})`);
        }

        return clean;
    }
};

export const verifyPythonVersion = async (logger: Logger, command = 'python3 --version'): Promise<void> => {
    logger.debug(`Getting python version with command: ${command}`);
    const [pythonVersionResponse] = await asyncExec(command);
    logger.debug('Raw output:');
    logger.debug(pythonVersionResponse);
    const pythonVersion = pythonVersionResponse.split(' ')[1];
    logger.debug(`Python version: ${pythonVersion}`);
    if (semver.lt(pythonVersion, minPythonVersion)){
        throw Error(`Invalid python version: ${pythonVersion} (must be >=${minPythonVersion})`);
    }
};

export const shouldDisableErrorMessage = (): boolean => {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const disableErrorMessageFlag = configuration.get<boolean>('disableErrorMessage', false);
    return disableErrorMessageFlag;
};

export const getPrismaUrl = (): string | undefined => {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('checkov');
    const prismaUrl = configuration.get<string>('prismaURL');
    return prismaUrl;
};
