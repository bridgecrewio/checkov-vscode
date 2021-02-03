import { Logger } from 'winston';
import { asyncExec } from './utils';

const updateCheckovWithPip3 = async (logger: Logger): Promise<void> => {
    try {
        logger.info('Trying to install Checkov using pip3.');
        await asyncExec('pip3 install -U checkov -i https://pypi.org/simple/');
        logger.info('Checkov installed successfully using pip3.');
    } catch (error) {
        logger.error('Failed to install or update Checkov using pip3. Error:', { error });
        throw new Error('Failed to install or update Checkov using pip3');
    }
};

type CheckovPython = 'pip3';
export interface CheckovInstallation {
    checkovPython: CheckovPython;
}

export const installOrUpdateCheckov = async (logger: Logger): Promise<CheckovInstallation> => {
    logger.info('Using pip3 to install checkov.');
    await updateCheckovWithPip3(logger);

    return { checkovPython: 'pip3' };
};
