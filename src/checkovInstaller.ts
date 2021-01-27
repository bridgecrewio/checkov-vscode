import { Logger } from 'winston';
import { asyncExec } from './utils';

const isMac = () => process.platform === 'darwin';

const isBrewInstalled = async (): Promise<boolean> => {
    const [stdout] = await asyncExec('brew --version');
    return stdout.startsWith('Homebrew');
};

const updateCheckovWithBrew = async (logger: Logger): Promise<void> => {
    try {
        logger.info('Trying to install Checkov using Brew.');
        await asyncExec('brew install checkov || brew upgrade checkov');
    } catch (error) {
        logger.error('Failed to install or update Checkov using Brew. Error:', { error });
        throw new Error('Failed to install or update Checkov using Brew');
    }
};

const updateCheckovWithSystemPython = async (logger: Logger): Promise<void> => {
    try {
        logger.info('Trying to install Checkov using pip3.');
        await asyncExec('pip3 install -U checkov');
    } catch (error) {
        logger.error('Failed to install or update Checkov using pip3. Error:', { error });
        throw new Error('Failed to install or update Checkov using pip3');
    }
};

type CheckovPython = 'pip3' | 'brew';
export interface CheckovInstallation {
    checkovPython: CheckovPython;
}

export const installOrUpdateCheckov = async (logger: Logger): Promise<CheckovInstallation> => {
    if (isMac() && await isBrewInstalled()) {
        await updateCheckovWithBrew(logger);
        logger.info('Checkov installed successfully using brew.');

        return { checkovPython: 'brew' };
    }

    logger.info('Using pip3 to install checkov.');
    await updateCheckovWithSystemPython(logger);
    logger.info('Checkov installed successfully using pip3.');

    return { checkovPython: 'pip3' };
};
