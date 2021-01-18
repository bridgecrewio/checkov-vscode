[![checkov](https://raw.githubusercontent.com/bridgecrewio/checkov/master/docs/web/images/checkov_by_bridgecrew.png)](#)
[![Maintained by Bridgecrew.io](https://img.shields.io/badge/maintained%20by-bridgecrew.io-blueviolet)](https://bridgecrew.io/?utm_source=github&utm_medium=organic_oss&utm_campaign=checkov)
[![build status](https://github.com/bridgecrewio/vscode-checkov/workflows/build/badge.svg)](https://github.com/bridgecrewio/checkov-vscode/actions?query=workflow%3Abuild)
[![security status](https://github.com/bridgecrewio/vscode-checkov/workflows/security/badge.svg)](https://github.com/bridgecrewio/vscode-checkov/actions?query=event%3Apush+branch%3Amaster+workflow%3Asecurity) 
[![code_coverage](https://raw.githubusercontent.com/bridgecrewio/vscode-checkov/master/coverage.svg?sanitize=true)](https://github.com/bridgecrewio/vscode-checkov/actions?query=workflow%3Acoverage)
[![PyPI](https://img.shields.io/pypi/v/checkov)](https://pypi.org/project/checkov/)
[![Python Version](https://img.shields.io/github/pipenv/locked/python-version/bridgecrewio/checkov)](#)
[![Terraform Version](https://img.shields.io/badge/tf-%3E%3D0.12.0-blue.svg)](#)
[![Downloads](https://pepy.tech/badge/checkov)](https://pepy.tech/project/checkov)
[![slack-community](https://slack.bridgecrew.io/badge.svg)](https://slack.bridgecrew.io/?utm_source=github&utm_medium=organic_oss&utm_campaign=checkov)
[![Installs-count](https://vsmarketplacebadge.apphb.com/installs-short/bridgecrew.checkov.svg)]


# Checkov Extension for Visual Studio Code



[Checkov](https://github.com/bridgecrewio/checkov) is a static code analysis tool for infrastrucutre-as-code. 

The Checkov Extension for VSCODE enables developers to get real-time scan results, as well as inline fix suggestions as they develop cloud infratructure.

Features include:

* 500 built-in policies covering security and compliance best practices for AWS, Azure and Google Cloud.
* Terraform, Terraform Plan, CloudFormation, Kubernetes, Helm, Serverless and ARM template scanning.
* Detects AWS credentials in EC2 Userdata, Lambda environment variables and Terraform providers.
* In Terraform, checks support evaluation of arguments expressed in variables and remote modules to their actual values.
* Supports inline suppression via comments.
* Links to policy descriptions, rationales as well as step by step instructions for fixing known misconfigurations.
*  Fix suggestions for commonly misconfigured Terraform and CloudFormation attributes.

## Getting started

### Install

Open the Checkov Extension for Visual Studio Code in the Visual Studio Markeplace.

### Dependencies

The Checkov extension will invoke the latest version of ```Checkov```.

### Configuration

* Sign up to a Bridgecrew Community account [here](http://bridgecrew.cloud/). If you already have an account, sign in and go to the next step.

* From [Integrations](https://www.bridgecrew.cloud/integrations/), select **API Token** and copy the API key.
* In Visual Studio Code, enter your API Token in the Checkov Extension settings page.

### Usage

* Open a file you wish to scan with checkov in VSCode.
* Open the command pallette (⇧⌘P) and run the command `Checkov Scan`.
* Scan results should now appear in your editor.
* Click a scan to see its details. Details will include the violating policy and a link to step-by-step fix guideliens. 
* In most cases, the Details will include a fix option. This will either add, remove or replace an unwanted configuration, based on the Checkov fix dictionaries.
* You can skip checks by adding an inline skip annotaiton ```checkov:skip=<check_id>:<suppression_comment>```. For more details see the [docs](https://github.com/bridgecrewio/checkov/blob/master/docs/2.Concepts/Suppressions.md).
* The extension will continue to scan file modifications and highlight errors in your editor upon every material resource modification.

## Contributing

Contribution is welcomed!

Start by reviewing the [contribution guidelines](https://github.com/bridgecrewio/checkov/blob/master/CONTRIBUTING.md). After that, take a look at a [good first issue](https://github.com/bridgecrewio/checkov/issues?q=is%3Aissue+is%3Aopen+label%3A"good+first+issue").

Looking to contribute new checks? Learn how to write a new check (AKA policy) [here](https://github.com/bridgecrewio/checkov/blob/master/docs/5.Contribution/New-Check.md).

## Disclaimer

`checkov` does not save, publish or share with anyone any identifiable customer information.
No identifiable customer information is used to query Bridgecrew's publicly accessible guides. `checkov` uses Bridgecrew's API to enrich the results with links to remediation guides. 

## Support

[Bridgecrew](https://bridgecrew.io/?utm_source=github&utm_medium=organic_oss&utm_campaign=checkov) builds and maintains Checkov to make policy-as-code simple and accessible.

Start with our [Documentation](https://bridgecrewio.github.io/checkov/) for quick tutorials and examples.

If you need direct support you can contact us at [info@bridgecrew.io](mailto:info@bridgecrew.io).
