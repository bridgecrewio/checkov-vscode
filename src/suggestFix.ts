import * as vscode from 'vscode';
import { FailedCheckovCheck } from './checkovRunner';
import { OPEN_EXTERNAL_COMMAND, REMOVE_DIAGNOSTICS_COMMAND } from './commands';
import { DiagnosticReferenceCode } from './diagnostics';
import { CHECKOV_MAP } from './extension';
import { createDiagnosticKey } from './utils';

const provideFixCodeActions = (workspaceState: vscode.Memento) => (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext): vscode.CodeAction[] => {
    // for each diagnostic entry that has the matching `code`, create a code action command
    const checkovMap = workspaceState.get<Record<string, FailedCheckovCheck>>(CHECKOV_MAP) || {};
    return context.diagnostics
        .map(diagnostic => createCommandCodeAction(document, diagnostic, checkovMap[createDiagnosticKey(diagnostic)]))
        .reduce((prev, current) => [...prev, ...current], []);
};

const generateSkipComment = (checkId: string) => `\t# checkov:skip=${checkId}: ADD REASON\n` ;

const createCommandCodeAction = (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, checkovCheck: FailedCheckovCheck): vscode.CodeAction[] => {
    const skipEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    skipEdit.insert(document.uri, document.lineAt(checkovCheck.fileLineRange[0]).range.start, generateSkipComment(checkovCheck.checkId));
    const skipCommand = checkovCheck.checkId.includes('_K8S_') ? [] : [
        {
            title: `Generate skip comment for - ${checkovCheck.checkName}`,
            kind: vscode.CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: false,
            edit: skipEdit,
            command: {
                title: 'Generate skip comment',
                command: REMOVE_DIAGNOSTICS_COMMAND
            }
        }
    ];
    const actions: vscode.CodeAction[] = [
        ...skipCommand,
        {
            title: `Learn more about - ${checkovCheck.checkName}`,
            kind: vscode.CodeActionKind.Empty,
            diagnostics: [diagnostic],
            command: {
                title: 'See more at Bridgecrew',
                command: OPEN_EXTERNAL_COMMAND,
                arguments: [(diagnostic.code as DiagnosticReferenceCode).target]
            }
        }
    ];

    if (checkovCheck && checkovCheck.fixedDefinition) {
        const blockRange = new vscode.Range(
            document.lineAt(checkovCheck.fileLineRange[0] - 1).range.start,
            document.lineAt(checkovCheck.fileLineRange[1] - 1).range.end
        );
        const fixEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        fixEdit.replace(document.uri, blockRange, checkovCheck.fixedDefinition);

        return [
            {
                title: `Apply fix for - ${checkovCheck.checkName}`,
                kind: vscode.CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: true,
                edit: fixEdit,
                command: {
                    title: 'Apply fix',
                    command: REMOVE_DIAGNOSTICS_COMMAND
                }
            },
            ...actions
        ];
    }
    return actions;
};

export const providedCodeActionKinds: vscode.CodeActionKind[] = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Empty
];

export const fixCodeActionProvider = (workspaceState: vscode.Memento): vscode.CodeActionProvider => ({
    provideCodeActions: provideFixCodeActions(workspaceState)
});
