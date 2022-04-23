import * as vscode from 'vscode';
import { Logger } from 'winston';
import { FailedCheckovCheck } from './checkov';

export interface DiagnosticReferenceCode {
    target: vscode.Uri;
    value: string;
}

export const applyDiagnostics = (document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection, failedCheckovChecks: FailedCheckovCheck[]): void => {
    const foundDiagnostics: vscode.Diagnostic[] = [];

    for (const failure of failedCheckovChecks) {
        const line = document.lineAt(failure.fileLineRange[0] > 0 ? failure.fileLineRange[0] - 1 : 0); // checkov results are 1-based; these lines are 0-based
        const startPos = line.range.start.translate({ characterDelta: line.firstNonWhitespaceCharacterIndex });
        const code: DiagnosticReferenceCode | string =
            failure.guideline?.startsWith('http') ? 
                {
                    target: vscode.Uri.parse(failure.guideline),
                    value: failure.checkId
                } : `${failure.checkId}${failure.guideline ? `: ${failure.guideline}` : ''}`;
        foundDiagnostics.push({
            message: `${failure.severity ? (failure.severity + ': ') : ''}${failure.checkName}`,
            range: new vscode.Range(startPos, line.range.end),
            severity: vscode.DiagnosticSeverity.Error,
            source: 'Checkov ',
            code
        });
    }

    diagnostics.set(document.uri ,foundDiagnostics);
};
