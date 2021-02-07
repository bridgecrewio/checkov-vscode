import * as path from 'path';
import { Logger } from 'winston';
import { asyncExec } from './utils';

const isCheckovInstalledGlobally = async () => {
    try {
        await asyncExec('checkov --version');
        return true;
    } catch (err) {
        return false;
    }
};

const installOrUpdateCheckovWithPip3 = async (logger: Logger): Promise<string | null> => {
    try {
        logger.info('Trying to install Checkov using pip3.');
        await asyncExec('pip3 install -U --user --verbose checkov -i https://pypi.org/simple/');
        
        if (await isCheckovInstalledGlobally()) {
            const checkovPath = 'checkov';
            logger.info('Checkov installed successfully using pip3.', { checkovPath });
            return checkovPath;
        }

        const [pythonUserBaseOutput] = await asyncExec('python3 -c \'import site; print(site.USER_BASE)\'');
        const checkovPath = path.join(pythonUserBaseOutput.trim(), 'bin', 'checkov');
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using pip3. Error:', { error });
        return null;
    }
};

const installOrUpdateCheckovWithPipenv = async (logger: Logger): Promise<string | null> => {
    try {
        logger.info('Trying to install Checkov using pipenv.');
        await asyncExec('pipenv --python 3 install checkov');
        const checkovPath = 'pipenv run checkov';
        logger.info('Checkov installed successfully using pipenv.', { checkovPath });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using pipenv. Error:', { error });
        return null;
    }
};

const installOrUpdateCheckovWithDocker = async (logger: Logger): Promise<string | null> => {
    try {
        logger.info('Trying to install Checkov using Docker.');
        await asyncExec('docker pull bridgecrew/checkov:latest');
        const checkovPath = 'docker';
        logger.info('Checkov installed successfully using Docker.', { checkovPath });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using Docker. Error:', { error });
        return null;
    }
};

type CheckovInstallationMethod = 'pip3' | 'pipenv' | 'docker';
export interface CheckovInstallation {
    checkovInstallationMethod: CheckovInstallationMethod;
    checkovPath: string;
}

export const installOrUpdateCheckov = async (logger: Logger): Promise<CheckovInstallation> => {
    const dockerCheckovPath = await installOrUpdateCheckovWithDocker(logger);
    if (dockerCheckovPath) return { checkovInstallationMethod: 'docker' , checkovPath: dockerCheckovPath };
    const pipenvCheckovPath = await installOrUpdateCheckovWithPipenv(logger);
    if (pipenvCheckovPath) return { checkovInstallationMethod: 'pipenv' , checkovPath: pipenvCheckovPath };
    const pip3CheckovPath = await installOrUpdateCheckovWithPip3(logger);
    if (pip3CheckovPath) return { checkovInstallationMethod: 'pip3' , checkovPath: pip3CheckovPath };

    throw new Error('Could not install Checkov.');
};
