# Semgrep GitHub Security Scanner

This GitHub App automatically performs security scanning using [Semgrep](https://semgrep.dev/) when pull requests are opened or reopened. It provides comprehensive security analysis and reports results as GitHub status checks and pull request comments.

## 🚀 Features

- **Automated Security Scanning**: Scans code for vulnerabilities when PRs are opened/reopened
- **GitHub Status Checks**: Creates status checks that can block merging if critical issues are found
- **Detailed Reporting**: Posts detailed findings as PR comments with severity levels
- **Text Output Integration**: Generates human-readable text output for easy consumption
- **External Webhook Support**: Send scan results to external monitoring systems
- **File Export**: Archive scan results to local files
- **Custom Rules**: Includes both Semgrep Registry rules and custom security patterns
- **Permission-Aware**: Gracefully handles missing permissions with informative logging

## 📋 New Text Output Features

🎉 **Now supports text output for better integration and readability!**

- **Human-Readable Format**: Same format as Semgrep CLI output
- **GitHub Comments**: Formatted text output in PR comments
- **Webhook Integration**: Send results to external services
- **File Export**: Save results for archival and analysis

📖 **[Complete Text Output Guide](./SEMGREP_TEXT_OUTPUT.md)**

## 📋 Requirements

- Node.js 20 or higher
- [Semgrep CLI](https://semgrep.dev/docs/getting-started/) installed
- A GitHub App with specific permissions (see setup guide)
- (For local development) A tunnel to expose your local server (e.g. [smee](https://smee.io/), [ngrok](https://ngrok.com/))

## ⚙️ Setup

### 1. GitHub App Configuration

**Important**: Your GitHub App needs specific permissions to function properly.

📖 **[Complete GitHub App Setup Guide](./GITHUB_APP_SETUP.md)**

Required permissions:

- **Checks**: Read & Write (for status checks)
- **Contents**: Read (for cloning repositories)
- **Issues**: Write (for posting comments)
- **Pull requests**: Read (for accessing PR data)

### 2. Application Setup

1. Clone this repository
2. Create a `.env` file similar to `.env.example` with your values
3. Install dependencies: `npm install`
4. Build the application: `npm run build`
5. Start the server: `npm run server`

### 3. Webhook Configuration

- Set your webhook URL to point to your server
- Subscribe to **Pull requests** events
- Ensure webhook secret matches your `.env` file

## 📖 Documentation

- **[Semgrep Integration Details](./SEMGREP_INTEGRATION.md)** - Complete feature documentation
- **[GitHub App Setup Guide](./GITHUB_APP_SETUP.md)** - Permission configuration guide

## Usage

With your server running, you can now create a pull request on any repository that
your app can access. GitHub will emit a `pull_request.opened` event and will deliver
the corresponding Webhook [payload](https://docs.github.com/webhooks-and-events/webhooks/webhook-events-and-payloads#pull_request) to your server.

The server in this example listens for `pull_request.opened` events and acts on
them by creating a comment on the pull request, with the message in `message.md`,
using the [octokit.js rest methods](https://github.com/octokit/octokit.js#octokitrest-endpoint-methods).

## Security considerations

To keep things simple, this example reads the `GITHUB_APP_PRIVATE_KEY` from the
environment. A more secure and recommended approach is to use a secrets management system
like [Vault](https://www.vaultproject.io/use-cases/key-management), or one offered
by major cloud providers:
[Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/secrets/quick-create-node?tabs=windows),
[AWS Secrets Manager](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/),
[Google Secret Manager](https://cloud.google.com/nodejs/docs/reference/secret-manager/latest),
etc.
