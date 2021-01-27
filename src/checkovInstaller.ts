import { Logger } from 'winston';
import { join } from 'path';
import { asyncExec } from './utils';

const updateCheckovWithSystemPython = async (logger: Logger, installInPath: string): Promise<string> => {
    try {
        logger.info('Trying to install Checkov using pip3.');
        await asyncExec(`pip3 install -U --target ${installInPath} checkov`);
        return join(installInPath, 'bin', 'checkov');
    } catch (error) {
        logger.error('Failed to install or update Checkov using pip3. Error:', { error });
        throw new Error('Failed to install or update Checkov using pip3');
    }
};

type CheckovPython = 'pip3';
export interface CheckovInstallation {
    checkovPython: CheckovPython;
    path: string;
}

export const installOrUpdateCheckov = async (logger: Logger, preferredPath: string): Promise<CheckovInstallation> => {
    logger.info('Using pip3 to install checkov.');
    const pipInstallPath = await updateCheckovWithSystemPython(logger, preferredPath);
    logger.info('Checkov installed successfully using pip3.');

    return { checkovPython: 'pip3', path: pipInstallPath };
};
