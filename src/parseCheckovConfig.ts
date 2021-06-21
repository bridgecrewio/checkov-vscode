import * as path from 'path';
import { existsSync } from 'fs';
import { getWorkspacePath } from './utils';
import { Logger } from 'winston';


export const getConfigFilePath = (logger: Logger): string | null => {
    const workspacePath = getWorkspacePath(logger);
    if (workspacePath) {
        const paths =  [path.join(workspacePath, '.checkov.yml'), path.join(workspacePath, '.checkov.yaml')];
        for (const p of paths) {
            if(existsSync(p)) return p;
        }
        return null;
    } else return null;
};



