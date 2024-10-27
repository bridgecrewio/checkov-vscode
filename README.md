[![build status](https://github.com/bridgecrewio/checkov-vscode/workflows/build/badge.svg)](https://github.com/bridgecrewio/checkov-vscode/actions?query=workflow%3Abuild)
[![Installs-count](https://vsmarketplacebadges.dev/installs-short/Bridgecrew.checkov.png)](https://marketplace.visualstudio.com/items?itemName=Bridgecrew.checkov)
[![slack-community](https://img.shields.io/badge/Slack-contact%20us-lightgrey.svg?logo=slack)](https://codifiedsecurity.slack.com/)

# Archival Notice
This repository is no longer maintained nor does the VS Code extension it encapsulate. 

Checkov VS Code extension was rebranded as the Prisma Cloud VS Code plugin and can now be found [here](https://github.com/bridgecrewio/prisma-cloud-vscode-plugin)

# Checkov Extension for Visual Studio Code

[Checkov](https://github.com/bridgecrewio/checkov) is a static code analysis tool for infrastructure-as-code, secrets, and software composition analysis.

The Checkov Extension for Visual Studio Code enables developers to get real-time scan results, as well as inline fix suggestions as they develop cloud infrastructure.

![Checkov VSCode plugin in action!](./docs/checkov-vscode-demo.gif)

The extension is currently available for download directly from the [Visual Studio Extension Marketplace](https://marketplace.visualstudio.com/items?itemName=Bridgecrew.checkov) and its source code is available in an [Apache 2.0 licensed repository](https://github.com/bridgecrewio/checkov-vscode). Development of the extension is ongoing and it is available for pre-release usage 🚧 .

Activating the extension requires a Prisma Cloud Access Key and API. It uses Prisma Cloud APIs to evaluate code and offer automated inline fixes. For more information about data shared with Prisma Cloud see the [Disclaimer](#disclaimer) section below).

Extension features include:

* [1000+ built-in policies](https://github.com/bridgecrewio/checkov/blob/master/docs/5.Policy%20Index/all.md) covering security and compliance best practices for AWS, Azure and Google Cloud.
* Terraform, Terraform Plan, CloudFormation, Kubernetes, Helm, Serverless and ARM template scanning.
* Detects [AWS credentials](https://github.com/bridgecrewio/checkov/blob/master/docs/2.Basics/Scanning%20Credentials%20and%20Secrets.md) in EC2 Userdata, Lambda environment variables and Terraform providers.
* In Terraform, checks support evaluation of arguments expressed in [variables](https://github.com/bridgecrewio/checkov/blob/master/docs/2.Basics/Handling%20Variables.md) and remote modules to their actual values.
* Supports inline [suppression](https://github.com/bridgecrewio/checkov/blob/master/docs/2.Basics/Suppressing%20and%20Skipping%20Policies.md) via comments.
* Links to policy descriptions, rationales as well as step by step instructions for fixing known misconfigurations.
* Fix suggestions for commonly misconfigured Terraform and CloudFormation attributes.

## Getting started

### Install

Open the Checkov Extension for Visual Studio Code in the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Bridgecrew.checkov).

### Dependencies

* [Python](https://www.python.org/downloads/) >= 3.7 or [Pipenv](https://docs.pipenv.org/) or [Docker](https://www.docker.com/products/docker-desktop) daemon running

The Checkov extension will invoke the latest version of ```Checkov```.

### Configuration

* In Prisma Cloud, go to Settings > Access Control > Add > Access Key and copy the keys.
* In Visual Studio Code, enter your keys and API endpoint in the Checkov Extension settings page.  
* Using a custom CA certificate is possible. If needed, set the path to the certificate file in the Checkov Extension settings page.

* If you find the error message noisy, you're able to disable it entirely by selecting `Disable error message` in the Checkov Extension settings page.


### Usage

* Open a file you wish to scan with checkov in VSCode.
* Open the command palette (⇧⌘P) and run the command `Checkov Scan`.
* Scan results should now appear in your editor.
* Click a scan to see its details. Details will include the violating policy and a link to step-by-step fix guidelines.
* In most cases, the Details will include a fix option. This will either add, remove or replace an unwanted configuration, based on the Checkov fix dictionaries.
* You can skip checks by adding an inline skip annotation ```checkov:skip=<check_id>:<suppression_comment>```. For more details see the [docs](https://github.com/bridgecrewio/checkov/blob/master/docs/2.Concepts/Suppressions.md).
* The extension will continue to scan file modifications and highlight errors in your editor upon every material resource modification.

### Troubleshooting logs

To access checkov-vscode logs directory, open the VSCODE Command Palette `(Ctrl+Shift+P)` or `(Command+Shift+P)`, and run the command `Open Checkov Log`. It is helpful if you delete the log file and then re-try whichever operation was failing in order to produce clean logs.

### Common Issues

#### Docker file access permissions on MacOS

If you are getting failures and are running the Checkov extension via Docker, it's possible MacOS needs to give Docker permission to access the directory location of your code.
In MacOS `System Preferences > Privacy and Security > Privacy` Find the `Files and Folders` section from the list, and ensure `Docker` has access to your code location.

![MacOS Files and Folders permissions page](./docs/docker-permissions.png)

Symptoms of this issue can be found in the extension logs, you will see `[info]: Running Checkov` with `executablePath: docker` and then output showing zero passed, failed, or skipped checks, and 1+ parsing errors, as below:

```shell
[info]: Running checkov {“executablePath”:“docker”,“arguments”
...
...
[debug]: Checkov task output:
...
 \“passed\“: 0,\r\n        \“failed\“: 0,\r\n        \“skipped\“: 0,\r\n        \“parsing_errors\“: 1,\r\n        \“checkov_version\“: \“1.0.770\“\r\n    }
```

## Contributing

Contribution is welcomed!

Start by reviewing the [contribution guidelines](https://github.com/bridgecrewio/checkov/blob/master/CONTRIBUTING.md). After that, take a look at a [good first issue](https://github.com/bridgecrewio/checkov/issues?q=is%3Aissue+is%3Aopen+label%3A"good+first+issue").

Looking to contribute new checks? Learn how to write a new check (AKA policy) [here](https://github.com/bridgecrewio/checkov/blob/master/docs/5.Contribution/New-Check.md).

## Disclaimer

To use this plugin, you will need a Prisma Cloud account. The plugin uses Prisma Cloud's fixes API to analyse and produce code fixes, and enrich the results provided into the IDE. Please notice the Prisma Cloud [privacy policy](paloaltonetworks.com/legal-notices/trust-center/privacy) for more details.
To generate fixes, files found to have triggered checkov violations are made available to the fixes API for the sole purpose of generating inline fixes code recommendations.
