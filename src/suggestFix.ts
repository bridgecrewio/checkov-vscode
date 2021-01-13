import * as vscode from 'vscode';
import { FailedCheckovCheck } from './checkovRunner';
import { CHECKOV_MAP, OPEN_EXTERNAL_COMMAND, REMOVE_DIAGNOSTICS_COMMAND } from './extension';
import { createDiagnosticKey } from './utils';

const provideFixCodeActions = (workspaceState: vscode.Memento) => (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] => {
    // for each diagnostic entry that has the matching `code`, create a code action command
    const checkovMap = workspaceState.get<Record<string, FailedCheckovCheck>>(CHECKOV_MAP) || {};
    return context.diagnostics
        .map(diagnostic => createCommandCodeAction(document, diagnostic, checkovMap[createDiagnosticKey(diagnostic)]))
        .reduce((prev, current) => [...prev, ...current], []);
};

const createCommandCodeAction = (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, checkovCheck: FailedCheckovCheck): vscode.CodeAction[] => {
    const learnMoreAction: vscode.CodeAction = {
        title: `Learn more about - ${checkovCheck.checkName}`,
        kind: vscode.CodeActionKind.Empty,
        diagnostics: [diagnostic],
        command: {
            title: 'See more at Bridgecrew',
            command: OPEN_EXTERNAL_COMMAND,
            arguments: [(diagnostic.code as {
                value: string | number;
                target: vscode.Uri;
            }).target]
        }
    };
    
    const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    if (checkovCheck && checkovCheck.fixedDefinition) { 
        const fixRange = new vscode.Range(document.lineAt(checkovCheck.fileLineRange[0] - 1).range.start, 
            document.lineAt(checkovCheck.fileLineRange[1] - 1).range.end);
        edit.replace(document.uri, fixRange, checkovCheck.fixedDefinition);
    
        return [{
            title: `Apply fix for - ${checkovCheck.checkName}`,
            kind: vscode.CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit,
            command: {
                title: 'Apply fix',
                command: REMOVE_DIAGNOSTICS_COMMAND
            }
        },
        learnMoreAction];
    }
    return [learnMoreAction];
};

export const providedCodeActionKinds: vscode.CodeActionKind[] = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Empty
];

export const fixCodeActionProvider = (workspaceState: vscode.Memento): vscode.CodeActionProvider => ({
    provideCodeActions: provideFixCodeActions(workspaceState)
});
