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

const updateCheckovWithBrew = async (): Promise<void> => {
    try {
        console.log('Trying to install Checkov using Brew.');
        await asyncExec('brew install checkov');
    } catch (err) {
        console.error('Failed to install or update Checkov using Brew. Error:', err);
        throw new Error('Failed to install or update Checkov using Brew');
    }
};

const updateCheckovWithPipenv = async (): Promise<void> => {
    try {
        console.log('Trying to install Checkov using Pipenv.');
        await asyncExec('pipenv install checkov');
    } catch (err) {
        console.error('Failed to install or update Checkov using Pipenv. Error:', err);
        throw new Error('Failed to install or update Checkov using Pipenv');
    }
};

const updateCheckovWithSystemPython = async (): Promise<void> => {
    try {
        console.log('Trying to install Checkov using system Python.');
        await asyncExec('pip3 install -U checkov');
    } catch (err) {
        console.error('Failed to install or update Checkov using system Python. Error:', err);
        throw new Error('Failed to install or update Checkov using system Python');
    }
};

type CheckovPython = 'pipenv' | 'system' | 'brew';
interface CheckovInstalltion {
    checkovPython: CheckovPython;
}

export const installOrUpdateCheckov = async (): Promise<CheckovInstalltion> => {
    if (isMac() && await isBrewInstalled()) {
        console.log('Trying to install with Mac Brew.');
        await updateCheckovWithBrew();
        return { checkovPython: 'brew' };
    }

    const pipenvVersion = await getPipenvVersion();

    const checkovPython: CheckovPython = pipenvVersion ? 'pipenv' : 'system';
    if (checkovPython === 'pipenv') {
        console.log('Pipenv is installed, version:', pipenvVersion);
        await updateCheckovWithPipenv();
    } else {
        console.log(`Pipenv is not installed, using system's python.`);
        await updateCheckovWithSystemPython();
    }
    console.log('Checkov updated successfully. Using', checkovPython);

    return { checkovPython };
};
