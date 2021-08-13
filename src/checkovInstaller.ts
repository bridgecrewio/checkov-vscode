import * as fs from 'fs';
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

const installOrUpdateCheckovWithPip3 = async (logger: Logger, checkovVersion: string): Promise<string | null> => {
    logger.info('Trying to install Checkov using pip3.');

    try {
        const command = `pip3 install --user -U -i https://pypi.org/simple/ checkov${checkovVersion === 'latest' ? '' : `==${checkovVersion}`}`;
        logger.debug(`Testing pip3 installation with command: ${command}`);
        await asyncExec(command);

        let checkovPath;
        if (await isCheckovInstalledGlobally()) {
            checkovPath = 'checkov';
        } else {
            const [pythonUserBaseOutput] = await asyncExec('python3 -c "import site; print(site.USER_BASE)"');
            checkovPath = path.join(pythonUserBaseOutput.trim(), 'bin', 'checkov');
        }
        logger.info('Checkov installed successfully using pip3.', { checkovPath });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using pip3. Error:', { error });
        return null;
    }
};

const installOrUpdateCheckovWithPipenv = async (logger: Logger, installationDir: string, checkovVersion: string): Promise<string | null> => {
    
    logger.info('Trying to install Checkov using pipenv.');

    try {
        fs.mkdirSync(installationDir, { recursive: true });
        logger.debug(`Installation dir: ${installationDir}`);
        const installCommand = `pipenv --python 3 install checkov${checkovVersion && checkovVersion.toLowerCase() !== 'latest' ? `==${checkovVersion}` : '~=2.0.0'}`;
        logger.debug(`Testing pipenv installation with command: ${installCommand}`);
        await asyncExec(installCommand, { cwd: installationDir });

        const getExeCommand = 'pipenv run which python';
        logger.debug(`Getting pipenv executable with command: ${getExeCommand}`);
        const execOutput = await asyncExec(getExeCommand, { cwd: installationDir });
        logger.debug(`pipenv python executable: ${execOutput[0]}`);

        const checkovPath = `"${path.join(path.dirname(execOutput[0]), 'checkov')}"`;
        logger.info('Checkov installed successfully using pipenv.', { checkovPath, installationDir });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using pipenv. Error:', { error });
        return null;
    }
};

const installOrUpdateCheckovWithDocker = async (logger: Logger, checkovVersion: string): Promise<string | null> => {
    
    logger.info('Trying to install Checkov using Docker.');
    try {
        const command = `docker pull bridgecrew/checkov:${checkovVersion}`;
        logger.debug(`Testing docker installation with command: ${command}`);
        await asyncExec(command);
        
        const checkovPath = 'docker';
        logger.info('Checkov installed successfully using Docker.', { checkovPath });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using Docker. Error: ', { error });
        return null;
    }
};

type CheckovInstallationMethod = 'pip3' | 'pipenv' | 'docker';
export interface CheckovInstallation {
    checkovInstallationMethod: CheckovInstallationMethod;
    checkovPath: string;
    version?: string;
}

export const installOrUpdateCheckov = async (logger: Logger, installationDir: string, checkovVersion: string): Promise<CheckovInstallation> => {
    const dockerCheckovPath = await installOrUpdateCheckovWithDocker(logger, checkovVersion);
    if (dockerCheckovPath) return { checkovInstallationMethod: 'docker' , checkovPath: dockerCheckovPath };
    const pip3CheckovPath = await installOrUpdateCheckovWithPip3(logger, checkovVersion);
    if (pip3CheckovPath) return { checkovInstallationMethod: 'pip3' , checkovPath: pip3CheckovPath };
    const pipenvCheckovPath =await installOrUpdateCheckovWithPipenv(logger, installationDir, checkovVersion);
    if (pipenvCheckovPath) return { checkovInstallationMethod: 'pipenv' , checkovPath: pipenvCheckovPath };

    throw new Error('Could not install Checkov.');
};
