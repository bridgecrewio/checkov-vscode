import * as path from 'path';
import { Logger } from 'winston';
import { asyncExec } from './utils';

const installOrUpdateCheckovWithPip3 = async (logger: Logger): Promise<string> => {
    try {
        logger.info('Trying to install Checkov using pip3.');
        await asyncExec('pip3 install -U --user checkov -i https://pypi.org/simple/');
        const [pythonUserBaseOutput] = await asyncExec('python3 -c \'import site; print(site.USER_BASE)\'');
        const checkovPath = path.join(pythonUserBaseOutput.trim(), 'bin', 'checkov');
        logger.info('Checkov installed successfully using pip3.', { checkovPath });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using pip3. Error:', { error });
        throw new Error('Failed to install or update Checkov using pip3');
    }
};

const isCheckovInstalledBeforePlugin = async () => {
    try {
        await asyncExec('checkov --version');
        return true;
    } catch (err) {
        return false;
    }
};

type CheckovInstallationMethod = 'pip3' | 'unknown';
export interface CheckovInstallation {
    checkovInstallationMethod: CheckovInstallationMethod;
    checkovPath: string;
}

export const installOrUpdateCheckov = async (logger: Logger): Promise<CheckovInstallation> => {
    const checkovInstalledBeforePlugin = await isCheckovInstalledBeforePlugin();
    if (checkovInstalledBeforePlugin) {
        logger.info('Checkov is installed on machine before plugin.');
        return {
            checkovInstallationMethod: 'unknown',
            checkovPath: 'checkov'
        };
    }

    logger.info('Using pip3 to install checkov.');
    const checkovPath = await installOrUpdateCheckovWithPip3(logger);

    return { checkovInstallationMethod: 'pip3' , checkovPath };
};
