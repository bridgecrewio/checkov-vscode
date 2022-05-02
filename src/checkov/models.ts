import { BoundedFileCache } from '../utils';

export interface FailedCheckovCheck {
    checkId: string;
    checkName: string;
    fileLineRange: [number, number];
    resource: string;
    guideline?: string;
    fixedDefinition?: string;
    severity?: string;
}

export interface CheckovResponse {
    results: {
        failedChecks: FailedCheckovCheck[];
    };
}

export interface FailedCheckovCheckRaw {
    check_id: string;
    bc_check_id: string | undefined;
    check_name: string;
    file_line_range: [number, number];
    resource: string;
    guideline?: string;
    description?: string;
    fixed_definition?: string;
    severity?: string;
    code_block?: string[];
    short_description?: string;
}

export interface CheckovResponseRaw {
    check_type: string;
    results: {
        failed_checks: FailedCheckovCheckRaw[];
    };
}

export interface ResultsCacheObject {
    [key: string]: BoundedFileCache;
}
