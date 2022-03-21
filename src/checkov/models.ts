export interface FailedCheckovCheck {
    checkId: string;
    checkName: string;
    fileLineRange: [number, number];
    resource: string;
    guideline?: string;
    fixedDefinition?: string;
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
}

export interface CheckovResponseRaw {
    results: {
        check_type: string;
        failed_checks: FailedCheckovCheckRaw[];
    };
}
