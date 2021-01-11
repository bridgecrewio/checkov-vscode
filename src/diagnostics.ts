import * as vscode from 'vscode';
import { FailedCheckovCheck } from './checkovRunner';

export const applyDiagnostics = (document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection, failedCheckovChecks: FailedCheckovCheck[]): void => {
    const foundDiagnostics: vscode.Diagnostic[] = [];
    
    for (const failure of failedCheckovChecks) {
        const line = document.lineAt(failure.file_line_range[0] - 1); // checkov results are 1-based; these lines are 0-based
        const startPos = line.range.start.translate({ characterDelta: line.firstNonWhitespaceCharacterIndex });
        
        foundDiagnostics.push({
            message: `${failure.check_id}: ${failure.check_name}`, 
            range: new vscode.Range(startPos, line.range.end),
            severity: vscode.DiagnosticSeverity.Warning
        });
    }

    diagnostics.set(document.uri ,foundDiagnostics);
};
