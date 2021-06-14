import * as path from 'path';
import { existsSync } from 'fs';
import { getWorkspacePath, readYAMLFile } from './utils';

export const getCheckovConfigObject = (): string | number | unknown | null => {
    // check if config file exists
    const configFilePath = getConfigFilePath(); 
    return configFilePath ? readYAMLFile(configFilePath) : null ;
};

export const getConfigFilePath = (): string | null => {
    const workspacePath = getWorkspacePath();
    if (workspacePath) {
        const paths =  [path.join(workspacePath, '.checkov.yml'), path.join(workspacePath, '.checkov.yaml')];
        for (const p of paths) {
            if(existsSync(p)) return p;
        }
        return null;
    } else return null;
};

export const serializeChecovConfig = (checkovConfigObject: string | number | unknown | null): string | number | unknown => {
    console.log(checkovConfigObject);
    return;
};


