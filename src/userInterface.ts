import * as vscode from 'vscode';

export const showContactUsDetails = (logDirectoryPath: vscode.Uri, logFileName: string): void => {
    const contactUsMessage = `
Any troubles? We can help you figure out what happened.
Open an issue on https://github.com/bridgecrewio/checkov-vscode
Or contact us directly on https://slack.bridgecrew.io .
Adding the log file will be very useful,
You can find it here:
${logDirectoryPath}`;
    
    vscode.window.showInformationMessage(contactUsMessage, 'Open log', 'Open issue', 'Slack us')
        .then(choice => {
            if (!choice) return;
            
            if (choice === 'Open log') {
                vscode.window.showTextDocument(vscode.Uri.joinPath(logDirectoryPath, logFileName));
                return;
            }

            const uri = 
                choice === 'Open issue' ? vscode.Uri.parse('https://github.com/bridgecrewio/checkov-vscode') 
                    : vscode.Uri.parse('https://slack.bridgecrew.io');
            
            vscode.env.openExternal(uri);
        });
};

export const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem();

export const initializeStatusBarItem = (onClickCommand: string): void  => {
    statusBarItem.command = onClickCommand;
    statusBarItem.text = 'Checkov';
    statusBarItem.show();
};

export const setReadyStatusBarItem = (): void => {
    statusBarItem.text = '$(gear) Checkov';
};

export const setMissingConfigurationStatusBarItem = (): void => {
    statusBarItem.text = '$(exclude) Checkov';
};

export const setSyncingStatusBarItem = (): void => {
    statusBarItem.text = '$(sync~spin) Checkov';
};

export const setErrorStatusBarItem = (): void => {
    statusBarItem.text = '$(error) Checkov';
};

export const setPassedStatusBarItem = (): void => {
    statusBarItem.text = '$(pass) Checkov';
};
