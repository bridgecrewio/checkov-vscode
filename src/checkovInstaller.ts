import {exec} from 'child_process';

const getPipenvVersion = async () : Promise<string | null> => {
    return new Promise((resolve, reject) => {
        exec('pipenv --version', (err, stdout, stderr) => {
            if (err) {return resolve(null);}
            const version = stdout.split(' ')[2].trim();
            resolve(version);
        });
    });
};

const updateCheckovWithPipenv = async (): Promise<void> => {
    console.log('Trying to install Checkov using Pipenv.');
    return new Promise((resolve, reject) => {
        exec('pipenv install checkov', (err, stdout, stderr) => {
            if (err) {
                console.error('Failed to install or update Checkov using Pipenv. Error:', err);
                return reject('Failed to install or update Checkov using Pipenv');
            }
            
            resolve();
        });
    });
};

const updateCheckovWithSystemPython = async (): Promise<void> => {
    console.log('Trying to install Checkov using system Python.');
    return new Promise((resolve, reject) => {
        exec('pip3 install -U checkov', (err, stdout, stderr) => {
            if (err) {
                console.error('Failed to install or update Checkov using system Python. Error:', err);
                return reject('Failed to install or update Checkov using system Python');
            }
            
            resolve();
        });
    });
};

type CheckovPython = 'pipenv' | 'system';
interface CheckovInstalltion {
    checkovPython: CheckovPython;
}

export const installOrUpdateCheckov = async () : Promise<CheckovInstalltion> => {
    let checkovPython: CheckovPython = 'pipenv';
    const pipenvVersion = await getPipenvVersion();
    if (pipenvVersion) {
        console.log('Pipenv is installed, version:', pipenvVersion);
        await updateCheckovWithPipenv();
    } else {
        console.log(`Pipenv is not installed, using system's python.`);
        await updateCheckovWithSystemPython();
        checkovPython = 'system';
    }
    console.log('Checkov updated successfully.');

    return {checkovPython};
};