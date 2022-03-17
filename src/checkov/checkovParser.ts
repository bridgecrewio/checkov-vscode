import { CheckovResponse, CheckovResponseRaw, FailedCheckovCheck, FailedCheckovCheckRaw } from './models';

interface SuccessResponseRaw {
    resource_count: 0;
    check_type: string;
    results: undefined;
}

const resultParserSCA = ({ useBcIds = false }: ParserOptions) => (rawCheck: FailedCheckovCheckRaw): FailedCheckovCheck => ({
    checkId: (useBcIds && rawCheck.bc_check_id) || rawCheck.check_id,
    checkName: `${(useBcIds && rawCheck.bc_check_id) || rawCheck.check_id} ${rawCheck.severity} `,
    fileLineRange: rawCheck.file_line_range,
    resource: rawCheck.resource,
    guideline: rawCheck.guideline || rawCheck.description,
    fixedDefinition: rawCheck.fixed_definition
});
const resultParserDefault = ({ useBcIds = false }: ParserOptions) => (rawCheck: FailedCheckovCheckRaw): FailedCheckovCheck => ({
    checkId: (useBcIds && rawCheck.bc_check_id) || rawCheck.check_id,
    checkName: rawCheck.check_name,
    fileLineRange: rawCheck.file_line_range,
    resource: rawCheck.resource,
    guideline: rawCheck.guideline || rawCheck.description,
    fixedDefinition: rawCheck.fixed_definition
});

type ParserFunction = (rawCheck: FailedCheckovCheckRaw) => FailedCheckovCheck;
interface ParserOptions {
    useBcIds?: boolean
}

const resultParsersByType: { [parser: string]: (options: ParserOptions) => ParserFunction } = {
    sca_package: resultParserSCA,
    default: resultParserDefault
};

export const parseCheckovResponse = (rawResponse: CheckovResponseRaw | SuccessResponseRaw, useBcIds: boolean | undefined): CheckovResponse => {
    if (!(Array.isArray(rawResponse) || rawResponse.results)) {
        if  (rawResponse.resource_count === 0) {
            return {
                results: {
                    failedChecks: []
                }
            };
        } else {
            throw new Error('Unexpected checkov response');
        }
    }

    let failedChecks: FailedCheckovCheckRaw[];
    if (Array.isArray(rawResponse)) {
        failedChecks = rawResponse.reduce((res, val) => res.concat(val.results.failed_checks), []);
    }
    else {
        failedChecks = rawResponse.results.failed_checks;
    }

    const parser: ParserFunction = (resultParsersByType[rawResponse.check_type] || resultParsersByType.default)({ useBcIds });
    return {
        results: {
            failedChecks: failedChecks.map(parser)
        }
    };
};
