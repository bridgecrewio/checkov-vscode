import * as vscode from 'vscode';
import { FailedCheckovCheck } from './checkovRunner';

export interface DiagnosticReferenceCode {
    target: vscode.Uri;
    value: string;
}

export const applyDiagnostics = (document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection, failedCheckovChecks: FailedCheckovCheck[]): void => {
    const foundDiagnostics: vscode.Diagnostic[] = [];

    for (const failure of failedCheckovChecks) {
        const line = document.lineAt(failure.fileLineRange[0] - 1); // checkov results are 1-based; these lines are 0-based
        const startPos = line.range.start.translate({ characterDelta: line.firstNonWhitespaceCharacterIndex });
        const code: DiagnosticReferenceCode = {
            target: vscode.Uri.parse(failure.guideline),
            value: failure.checkId
        };

        foundDiagnostics.push({
            message: failure.checkName,
            range: new vscode.Range(startPos, line.range.end),
            severity: vscode.DiagnosticSeverity.Error,
            source: 'Checkov ',
            code
        });
    }

    diagnostics.set(document.uri ,foundDiagnostics);
};
