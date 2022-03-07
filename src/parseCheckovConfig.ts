import * as path from 'path';
import { existsSync } from 'fs';
import { Logger } from 'winston';
import { getWorkspacePath } from './utils';


export const getConfigFilePath = (logger: Logger): string | undefined => {
    const workspacePath = getWorkspacePath(logger);
    if (workspacePath) {
        const paths =  [path.join(workspacePath, '.checkov.yml'), path.join(workspacePath, '.checkov.yaml')];
        for (const path of paths) {
            if(existsSync(path)) return path;
        }
    }
    return undefined;
};


