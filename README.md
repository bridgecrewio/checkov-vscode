# checkov README

PoC of checkov VSCode extension.

To use:

Pre-req: Ensure you have the `checkov` command available globally (e.g., `pip3 install checkov` using the system python3 installation). The current method of execution cannot pick up shell aliases, functions, etc.

(However, you can modify the command to run from your local repo by setting `PYTHONPATH` in the command options, and invoking your local checkov virtualenv/pipenv.)

1. Clone this repo and open it in VSCode.
2. Press F5 - this opens a VSCode instance with the extension loaded
3. Open a file that checkov can scan
4. Open the command pallette (⇧⌘P) and run the command `Checkov Scan`

You should see results highlighted in the editor.

## To-do

There are many improvements to be made around overall usability (e.g., checking / installing checkov / bridgecrew), docs, etc.

A few immediate to-do items include:

1. Keep the editor decorations active if the active editor is changed (they go away if you switch to a new file and then switch back)
2. Figure out a way to scan more dynamically without actually running a scan every time the user edits the file (e.g., when the file is saved, but it would be nice to do it more real-time)

## Docs for VSCode extensions

Hello world: https://code.visualstudio.com/api/get-started/your-first-extension
Sample decorator (shows how to update decorations on every file change): https://github.com/microsoft/vscode-extension-samples/tree/master/decorator-sample
VSCode API: https://code.visualstudio.com/api/references/vscode-api

