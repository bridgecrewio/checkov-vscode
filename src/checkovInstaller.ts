import * as fs from 'fs';
import * as path from 'path';
import { Logger } from 'winston';
import { getAutoUpdate, getCheckovVersion } from './configuration';
import { asyncExec, runVersionCommand } from './utils';

export const minCheckovVersion = '2.0.0';

const isCheckovInstalledGlobally = async () => {
    try {
        await asyncExec('checkov --version');
        return true;
    } catch (err) {
        return false;
    }
};

const validateCheckovVersion = (checkovVersion: string | undefined) => {
    // validates that the version is >= the min version (or it can be null)
    // does NOT validate that the version actually exists (this will happen during the actual installation)
    // assumes the value came from getCheckovVersion helper method
    // a normal return indicates the version is valid, otherwise an error is thrown

    if (!checkovVersion) {
        return;
    }

    const parts = checkovVersion.split('.').map(i => parseInt(i));
    if (parts.length !== 3) {
        throw new Error(`Invalid specified checkov version: ${checkovVersion} (expected format #.#.#)`);
    }

    const minVersion = minCheckovVersion.split('.').map(i => parseInt(i));

    let aboveMinimum = true;

    for (let index = 0; index < 3; index++) {
        // Validate left to right until we find a mismatch (also make sure we parsed actual numbers)
        if (isNaN(parts[index])) {
            throw new Error(`Invalid specified checkov version ${checkovVersion} (expected format #.#.#)`);
        }

        if (parts[index] > minVersion[index]) {
            // all previous parts were ==, so this means we are above the minimum
            break;
        }
        else if (parts[index] < minVersion[index]) {
            // all previous parts were ==, so this means we are below the minimum
            aboveMinimum = false;
            break;
        }
    }

    if (!aboveMinimum) {
        throw new Error(`Checkov version ${checkovVersion} is below the minimum supported version of ${minCheckovVersion}`);
    }
};

const installOrUpdateCheckovWithPip3 = async (logger: Logger, autoUpdate: boolean, checkovVersion: string | undefined): Promise<string | null> => {
    logger.info('Trying to install Checkov using pip3.');

    // Pip version logic:
    // if a version is specified, install that ('pip install checkov==1.2.3' will remove any other version)
    // otherwise, if autoupdate is true, then run with -U and no version
    // otherwise just run 'pip install checkov', which will do nothing (other than validate that the pip3 installation works) 
    // if any version is installed.

    try {
        let command = 'pip3 install --user --verbose ';
        if (checkovVersion) {
            command += `checkov==${checkovVersion} `;
        } else if (autoUpdate) {
            command += '-U checkov ';
        } else {
            command += 'checkov ';
        }
        command += '-i https://pypi.org/simple/';

        logger.debug(`Testing pip3 installation with the command: ${command}`);
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

const installOrUpdateCheckovWithPipenv = async (logger: Logger, installationDir: string, autoUpdate: boolean, checkovVersion: string | undefined): Promise<string | null> => {
    
    // pipenv version logic:
    // if a version is specified, run pipenv install checkov==1.2.3
    // otherwise, if autoupdate is true, run pipenv install checkov~=2.0.0 (will upgrade if needed)
    // otherwise, since pipenv does not have a way to "install" without upgrading, we have to do a workaround.
    
    logger.info('Trying to install Checkov using pipenv.');

    try {
        fs.mkdirSync(installationDir, { recursive: true });

        if (!autoUpdate && !checkovVersion) {
            // auto-update is off, and there is no pinned version, so we have to see if checkov is already installed
            // with pipenv; if it is, then we should be able to run it and it will work.
            // if it's not, then we will just try installing it below
            // this is a workaround to the issue described above
            try {
                logger.debug('Auto update is false with no pinned version - attempting pipenv run checkov to see if it is installed');
                await asyncExec('pipenv run checkov -v', { cwd: installationDir });
            } catch (error) {
                logger.debug('pipenv run checkov failed - will attempt to install checkov with pipenv');
                autoUpdate = true; // allow the next block to run as if this is a first-time installation
            }
        }

        if (autoUpdate || checkovVersion) {
            const version = checkovVersion ? `==${checkovVersion}` : '~=2.0.0';
            logger.debug(`Attempting pipenv install checkov${version}`);
            await asyncExec(`pipenv --python 3 install checkov${version}`, { cwd: installationDir });
        }

        const checkovPath = 'pipenv run checkov';
        logger.info('Checkov installed successfully using pipenv.', { checkovPath, installationDir });
        return checkovPath;
    } catch (error) {
        logger.error('Failed to install or update Checkov using pipenv. Error:', { error });
        return null;
    }
};

const installOrUpdateCheckovWithDocker = async (logger: Logger, autoUpdate: boolean, checkovVersion: string | undefined): Promise<string | null> => {
    
    // Docker version logic:
    // If a version is specified, pull that version.
    // Otherwise, if auto-update is true, pull latest.
    // Otherwise, do not pull anything (but use `run` to ensure we have it locally)

    logger.info('Trying to install Checkov using Docker.');
    try {
        if (!autoUpdate && !checkovVersion) {
            logger.debug('Auto-update is false and there is no specified version; using whatever the local latest tag is');
            // This command will pull latest if this is the first time run, otherwise it will use what's there without updating it
            // This is the best way to validate that we have a runnable checkov image using docker
            await asyncExec('docker run bridgecrew/checkov:latest -v');
            const checkovPath = 'docker';
            logger.info('Checkov installed successfully using Docker.', { checkovPath });
            return checkovPath;
            
        } else {
            const tag = checkovVersion || 'latest';
            logger.debug(`Attempting to pull docker bridgecrew/checkov:${tag}`);
            await asyncExec(`docker pull bridgecrew/checkov:${tag}`);
            const checkovPath = 'docker';
            logger.info('Checkov installed successfully using Docker.', { checkovPath });
            return checkovPath;
        }
    } catch (error) {
        logger.error('Failed to install or update Checkov using Docker. Error:', { error });
        return null;
    }
};

type CheckovInstallationMethod = 'pip3' | 'pipenv' | 'docker';
export interface CheckovInstallation {
    checkovInstallationMethod: CheckovInstallationMethod;
    checkovPath: string;
    workingDir?: string;
    version?: string;
}

export const installOrUpdateCheckov = async (logger: Logger, installationDir: string): Promise<CheckovInstallation> => {
    const autoUpdate = getAutoUpdate();
    const checkovVersion = getCheckovVersion();

    validateCheckovVersion(checkovVersion);

    // when we attempt to install checkov, the method that succeeds determines the return value of this method.
    // thus, we still need to run these methods, even if autoUpdate is false or there is a pinned checkov version,
    // otherwise the plugin will not know which command to use
    // the logic is a little different for each installer, so it's hard to reuse here

    let installation: CheckovInstallation | null = null;

    const dockerCheckovPath = await installOrUpdateCheckovWithDocker(logger, autoUpdate, checkovVersion);
    if (dockerCheckovPath) installation = { checkovInstallationMethod: 'docker' , checkovPath: dockerCheckovPath, version: checkovVersion };

    if (!installation) {
        const pip3CheckovPath = await installOrUpdateCheckovWithPip3(logger, autoUpdate, checkovVersion);
        if (pip3CheckovPath) installation = { checkovInstallationMethod: 'pip3' , checkovPath: pip3CheckovPath };
    }

    if (!installation) {
        const pipenvCheckovPath = await installOrUpdateCheckovWithPipenv(logger, installationDir, autoUpdate, checkovVersion);
        if (pipenvCheckovPath) installation = { checkovInstallationMethod: 'pipenv' , checkovPath: pipenvCheckovPath, workingDir: installationDir };
    }

    if (installation) {
        logger.debug('Checkov installation: ', installation);
        runVersionCommand(logger, installation.checkovPath, installation.workingDir);
        return installation;
    } else {
        throw new Error('Could not install Checkov.');
    }
};
