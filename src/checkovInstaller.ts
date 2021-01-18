import { Logger } from 'winston';
import { asyncExec } from './utils';

const isMac = () => process.platform === 'darwin';

const isBrewInstalled = async (): Promise<boolean> => {
    const [stdout] = await asyncExec('brew --version');
    return stdout.startsWith('Homebrew');
};

const getPipenvVersion = async (): Promise<string | null> => {
    const [stdout] = await asyncExec('pipenv --version');
    const version = stdout.split(' ')[2].trim();
    return version;
};

const updateCheckovWithBrew = async (logger: Logger): Promise<void> => {
    try {
        logger.info('Trying to install Checkov using Brew.');
        await asyncExec('brew upgrade checkov || brew upgrade checkov');
    } catch (error) {
        logger.error('Failed to install or update Checkov using Brew. Error:', { error });
        throw new Error('Failed to install or update Checkov using Brew');
    }
};

const updateCheckovWithPipenv = async (logger: Logger): Promise<void> => {
    try {
        logger.info('Trying to install Checkov using Pipenv.');
        await asyncExec('pipenv install checkov');
    } catch (error) {
        logger.error('Failed to install or update Checkov using Pipenv. Error:', { error });
        throw new Error('Failed to install or update Checkov using Pipenv');
    }
};

const updateCheckovWithSystemPython = async (logger: Logger): Promise<void> => {
    try {
        logger.info('Trying to install Checkov using system Python.');
        await asyncExec('pip3 install -U checkov');
    } catch (error) {
        logger.error('Failed to install or update Checkov using system Python. Error:', { error });
        throw new Error('Failed to install or update Checkov using system Python');
    }
};

type CheckovPython = 'pipenv' | 'system' | 'brew';
export interface CheckovInstallation {
    checkovPython: CheckovPython;
}

export const installOrUpdateCheckov = async (logger: Logger): Promise<CheckovInstallation> => {
    if (isMac() && await isBrewInstalled()) {
        await updateCheckovWithBrew(logger);
        logger.info('Checkov updated successfully using brew');

        return { checkovPython: 'brew' };
    }

    const pipenvVersion = await getPipenvVersion();

    const checkovPython: CheckovPython = pipenvVersion ? 'pipenv' : 'system';
    if (checkovPython === 'pipenv') {
        logger.info('Pipenv is installed, version', { pipenvVersion });
        await updateCheckovWithPipenv(logger);
    } else {
        logger.info('Pipenv is not installed, using system\'s python.');
        await updateCheckovWithSystemPython(logger);
    }
    logger.info('Checkov updated successfully using', { checkovPython });

    return { checkovPython };
};
