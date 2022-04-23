import { CheckovResponse, CheckovResponseRaw, FailedCheckovCheck, FailedCheckovCheckRaw } from './models';

interface SuccessResponseRaw {
    resource_count: 0;
    check_type: string;
    results: undefined;
}

const resultParserSCA = ({ useBcIds = false }: ParserOptions) => (rawCheck: FailedCheckovCheckRaw): FailedCheckovCheck => ({
    checkId: (useBcIds && rawCheck.bc_check_id) || rawCheck.check_id,
    checkName: `${(useBcIds && rawCheck.bc_check_id) || rawCheck.check_id} ${rawCheck.code_block ? rawCheck.code_block[0][1] : ''} ${rawCheck.severity} `,
    fileLineRange: rawCheck.file_line_range,
    resource: rawCheck.resource,
    guideline: rawCheck.guideline || rawCheck.short_description,
    fixedDefinition: rawCheck.fixed_definition,
    severity: rawCheck.severity
});
const resultParserDefault = ({ useBcIds = false }: ParserOptions) => (rawCheck: FailedCheckovCheckRaw): FailedCheckovCheck => ({
    checkId: (useBcIds && rawCheck.bc_check_id) || rawCheck.check_id,
    checkName: rawCheck.check_name,
    fileLineRange: rawCheck.file_line_range,
    resource: rawCheck.resource,
    guideline: rawCheck.guideline || rawCheck.description,
    fixedDefinition: rawCheck.fixed_definition,
    severity: rawCheck.severity
});

type ParserFunction = (rawCheck: FailedCheckovCheckRaw) => FailedCheckovCheck;
interface ParserOptions {
    useBcIds?: boolean
}

const resultParsersByType: { [parser: string]: (options: ParserOptions) => ParserFunction } = {
    sca_package: resultParserSCA,
    default: resultParserDefault
};

const getFailedChecks = (checkovResponse: CheckovResponseRaw, useBcIds: boolean | undefined): FailedCheckovCheck[] => {
    const responseByType: CheckovResponseRaw[] = Array.isArray(checkovResponse) ? checkovResponse : [checkovResponse];

    return responseByType.reduce((result, current) => {
        const parser: ParserFunction = (resultParsersByType[current.check_type] || resultParsersByType.default)({ useBcIds });
        const parsedChecks: FailedCheckovCheck[] = current.results.failed_checks.map(parser);
        return [...result, ...parsedChecks];
    }, [] as FailedCheckovCheck[]);
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

    return {
        results: {
            failedChecks: getFailedChecks(rawResponse as CheckovResponseRaw, useBcIds)
        }
    };
};
