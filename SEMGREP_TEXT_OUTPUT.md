# Semgrep Text Output Integration

This document explains the new text output functionality for Semgrep GitHub App.

## Overview

The app now supports generating and sending Semgrep scan results in both JSON format (for programmatic processing) and text format (for human-readable display).

## Features

### 1. Text Output Generation

The app now generates readable text output alongside JSON results using the `-o` flag:

```typescript
const { jsonResult, textOutput } =
  await semgrepService.scanDirectoryForTextOutput(targetPath, options);
```

### 2. GitHub Comment Integration

Text output is automatically formatted and posted to GitHub pull request comments:

```markdown
🔍 **Semgrep Security Scan Results**

Found **5** potential security issue(s):
```

┌──────────────────┐
│ 5 Code Findings │
└──────────────────┘

Dockerfile
❯❯❱ dockerfile.security.missing-user.missing-user
By not specifying a USER, a program in the container may run as 'root'...

```

*This scan was performed automatically when the pull request was opened.*
```

### 3. External Webhook Integration

Send scan results to external services:

```bash
# Set webhook URL
export SEMGREP_WEBHOOK_URL="https://your-webhook-endpoint.com/semgrep-results"
```

The webhook payload includes:

```json
{
  "timestamp": "2024-10-02T10:30:00.000Z",
  "source": "semgrep-github-app",
  "scanResults": {
    "textOutput": "...",
    "findingsCount": 5
  },
  "repository": "owner/repo",
  "pullRequest": 123,
  "branch": "feature-branch"
}
```

### 4. File Export

Export results to local files for archival:

```bash
# Enable file export
export EXPORT_RESULTS=true
```

Files are saved to `./exports/` directory with timestamps.

## Configuration

### Environment Variables

| Variable              | Description              | Default | Required |
| --------------------- | ------------------------ | ------- | -------- |
| `SEMGREP_WEBHOOK_URL` | URL to send scan results | -       | No       |
| `EXPORT_RESULTS`      | Export results to files  | `false` | No       |
| `SEMGREP_CONFIG`      | Semgrep config to use    | `auto`  | No       |
| `SEMGREP_TIMEOUT`     | Scan timeout in seconds  | `300`   | No       |

### Example .env

```bash
# Required GitHub App settings
APP_ID=123456
PRIVATE_KEY_PATH=./private-key.pem
WEBHOOK_SECRET=your-webhook-secret

# Optional Semgrep settings
SEMGREP_WEBHOOK_URL=https://your-webhook.com/semgrep
EXPORT_RESULTS=true
SEMGREP_CONFIG=auto
SEMGREP_TIMEOUT=600
```

## API Usage

### Generate Text Output

```typescript
import { SemgrepService } from "./services/semgrep.js";

const semgrepService = new SemgrepService();

// Get both JSON and text output
const { jsonResult, textOutput } =
  await semgrepService.scanDirectoryForTextOutput("./src", {
    config: "auto",
    severity: ["ERROR", "WARNING"],
    timeout: 300,
  });

console.log("Findings:", jsonResult.results.length);
console.log("Text Output:", textOutput);
```

### Send to External Service

```typescript
// Send to webhook
await semgrepService.sendToExternalService(textOutput, "https://webhook.com", {
  repository: "owner/repo",
  pullRequest: 123,
  branch: "main",
  findingsCount: jsonResult.results.length,
});
```

### Export to File

```typescript
// Export to file
const filePath = await semgrepService.exportToFile(
  textOutput,
  "scan-results.txt",
  "./exports"
);
console.log("Exported to:", filePath);
```

### Post to GitHub

```typescript
import { postSemgrepResultsComment } from "./services/github.js";

// Post formatted comment to PR
await postSemgrepResultsComment(
  octokit,
  "owner",
  "repo",
  123, // PR number
  textOutput,
  jsonResult.results.length,
  "opened"
);
```

## Text Output Format

The text output matches Semgrep CLI's default format:

```
┌──────────────────┐
│ 29 Code Findings │
└──────────────────┘

  Dockerfile
   ❯❯❱ dockerfile.security.missing-user.missing-user
       By not specifying a USER, a program in the container may run as 'root'. This is a security hazard.
       Details: https://sg.run/Gbvn

        ▶▶┆ Autofix ▶ USER non-root CMD ["nginx", "-g", "daemon off;"]
        46┆ CMD ["nginx", "-g", "daemon off;"]

  src/environments/environment.ts
   ❯❯❱ generic.secrets.security.detected-generic-api-key.detected-generic-api-key
       Generic API Key detected
       Details: https://sg.run/qxj8

        8┆ exceptionlessAPIKey: 'nyrA0IdRLmy5mGpUJnHjMe7JtUBw1eSxkSR4lir9',
```

## Benefits

1. **Human-Readable**: Easy to read and understand scan results
2. **Automated Distribution**: Send results to multiple destinations
3. **Archival**: Keep historical records of scans
4. **Integration**: Connect with external monitoring and alerting systems
5. **Consistency**: Same format as Semgrep CLI output

## Troubleshooting

### Common Issues

1. **Empty text output**: Ensure Semgrep CLI is installed and accessible
2. **Webhook failures**: Check URL accessibility and authentication
3. **File export errors**: Verify write permissions to export directory
4. **GitHub comment failures**: Ensure app has `issues: write` permission

### Debug Logging

Enable debug logging to troubleshoot issues:

```bash
export DEBUG=semgrep:*
```

The app will log detailed information about:

- Semgrep command execution
- File operations
- Webhook requests
- GitHub API calls
