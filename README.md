[![checkov](https://raw.githubusercontent.com/bridgecrewio/checkov/master/docs/web/images/checkov_by_bridgecrew.png)](#)
 **for VS Code**

[![Maintained by Bridgecrew.io](https://img.shields.io/badge/maintained%20by-bridgecrew.io-blueviolet)](https://bridgecrew.io/?utm_source=github&utm_medium=organic_oss&utm_campaign=checkov)
[![Installs-count](https://marketplace.visualstudio.com/items?itemName=bridgecrew.checkov)(https://vsmarketplacebadge.apphb.com/installs-short/bridgecrew.checkov.svg)



--GIF---



[Checkov](https://github.com/bridgecrewio/checkov) is a static code analysis tool for infrastructure-as-code.

It scans cloud infrastructure provisioned using Terraform, Cloudformation, Kubernetes, Serverless or ARM Templates and detects security and compliance misconfigurations.

Checkov's plugin for VS Code scans you infrastructutre-as-code files as you code, so you can easily prevent misconfigurations.

Checkov also powers Bridgecrew, the developer-first platform that codifies and streamlines cloud security throughout the development lifecycle. Bridgecrew identifies, fixes, and prevents misconfigurations in cloud resources and infrastructure-as-code files.

Integrating you checkov scanner with Bridgecrew's api enables you to easily fix errors or suppress them, and to include your [custom policies](https://docs.bridgecrew.io/docs/building-custom-policies) in the scan.


## Features
* Over 400 built-in policies cover security and compliance best practices for AWS, Azure and Google Cloud.
* Scans Terraform, Terraform Plan, CloudFormation, Kubernetes, Serverless framework and ARM template files.
* Detects AWS credentials in EC2 Userdata, Lambda environment variables and Terraform providers.
* Evaluates Terraform Provider settings to regulate the creation, management, and updates of IaaS, PaaS or SaaS managed through Terraform.
* Offers quick fixes for errors, that immediately fix the code

## Installation
* Make sure you have checkov installed and the `checkov` command available globally, or install it by running:

`brew install checkov` / `pip3 install checkov`

* Look for [checkov extension](link) in your VS Code marketplace and click `install`

* Get your Bridgecrew API token from https://www.bridgecrew.cloud/integrations/api-token or read about it [here](https://docs.bridgecrew.io/docs/get-api-token)

* Open a file you wish to scan with checkov in VS Code, and it is saved.

* Open the command pallette (⇧⌘P) and run the command `Checkov Scan`

* Results would appear as highlights in your editor

* For every error, you can fix it (if there is an avaiable fix), learn about it, or suppress it if you wish not to see it again.





## Internal:
Pre-requesite: Ensure you have the `checkov` command available globally (e.g., `pip3 install checkov` using the system python3 installation). The current method of execution cannot pick up shell aliases, functions, etc.

However, you can modify the command to run from your local repo by setting `PYTHONPATH` in the command options, and invoking your local checkov virtualenv/pipenv. This is useful if you like to have the `checkov` command in your shell always run your local repo clone.

Example:
```
let python = '/path/to/checkov/venv/python'
const ckv = spawn(python, ['-m', 'checkov.main', '-f', editor.document.fileName, '-o', 'json'], {env: {'PYTHONPATH': '/path/to/checkovroot'}});
```

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
Sample decorator (shows how to update decorations on every file change): https://github.com/microsoft/vscode-extension-samples/tree/master decorator-sample  
VSCode API: https://code.visualstudio.com/api/references/vscode-api

