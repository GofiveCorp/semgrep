# Semgrep Security Scanning Integration

This GitHub App now includes automated security scanning using [Semgrep](https://semgrep.dev/) when pull requests are opened or reopened.

## ⚠️ Required GitHub App Permissions

Before the security scanning can work, you need to configure the following permissions for your GitHub App:

### Required Permissions

1. **Go to your GitHub App settings**:

   - Visit: `https://github.com/settings/apps/[your-app-name]`
   - Or navigate to Settings → Developer settings → GitHub Apps → [Your App]

2. **Set Repository Permissions**:

   - **Checks**: `Read & Write` ✅ (Required for creating status checks)
   - **Contents**: `Read` ✅ (Required for cloning repository)
   - **Issues**: `Write` ✅ (Required for posting comments)
   - **Pull requests**: `Read` ✅ (Required for accessing PR data)

3. **Set Webhook Events**:

   - **Pull requests** ✅ (Required for triggering scans)

4. **Save and regenerate webhook secret** if needed

### Installation Requirements

The GitHub App must be installed on repositories where you want security scanning to work. After updating permissions, you may need to:

1. **Reinstall the app** on existing repositories
2. **Accept new permissions** when prompted
3. **Verify webhook delivery** is working

## Features

🔍 **Automatic Security Scanning**: Every pull request is automatically scanned for security vulnerabilities using Semgrep's comprehensive rule set.

🚨 **GitHub Status Checks**: Security scan results are reported as GitHub status checks that can block merging if critical issues are found.

💬 **Detailed Comments**: Scan results are posted as comments on pull requests with detailed information about any security findings.

⚡ **Fast & Efficient**: Scans typically complete within 1-2 minutes and only scan the changed code in the pull request.

## How It Works

1. **Pull Request Trigger**: When a pull request is opened or reopened, the GitHub App receives a webhook event.

2. **Repository Cloning**: The app securely clones the repository branch using GitHub App authentication.

3. **Security Scanning**: Semgrep analyzes the code for:

   - SQL injection vulnerabilities
   - Cross-site scripting (XSS) issues
   - Hardcoded secrets and tokens
   - Path traversal vulnerabilities
   - Unsafe use of eval() and similar functions
   - GitHub App specific security patterns

4. **Results Reporting**:
   - A GitHub status check is created showing pass/fail status
   - Detailed findings are posted as pull request comments
   - Critical issues will fail the status check

## Semgrep Rules

The scanning uses a combination of:

- **Semgrep Registry Rules** (`auto` config): Comprehensive, community-maintained security rules
- **Custom Rules** (`.semgrep.yml`): Project-specific security patterns including:
  - JavaScript/TypeScript security vulnerabilities
  - GitHub App token exposure prevention
  - Webhook security verification

### Custom Rule Categories

| Category          | Severity | Description                                        |
| ----------------- | -------- | -------------------------------------------------- |
| Hardcoded Secrets | ERROR    | Detects hardcoded API keys, tokens, and passwords  |
| SQL Injection     | ERROR    | Identifies potential SQL injection vulnerabilities |
| Token Exposure    | ERROR    | Prevents accidental logging of sensitive tokens    |
| Unsafe Eval       | WARNING  | Flags dangerous use of eval() and Function()       |
| Path Traversal    | WARNING  | Detects potential directory traversal issues       |
| Webhook Security  | INFO     | Ensures proper webhook verification                |

## Configuration

### Environment Variables

No additional environment variables are required. The security scanning uses the existing GitHub App credentials.

### Semgrep Configuration

The app uses two sources of security rules:

1. **Semgrep Registry** (`auto` config): Automatically maintained rules from the Semgrep community
2. **Custom Rules** (`.semgrep.yml`): Project-specific security patterns

### Scan Settings

Default scan configuration:

- **Timeout**: 5 minutes per scan
- **Excluded Paths**: `node_modules/*`, `dist/*`, `build/*`, `*.min.js`, `coverage/*`, `.git/*`
- **Severity Levels**: ERROR and WARNING (INFO rules available but not blocking)

## GitHub Status Checks

The security scan creates a status check with the following conclusions:

- ✅ **Success**: No security issues found
- ⚠️ **Neutral**: Only warnings found (allows merge but recommends review)
- ❌ **Failure**: Critical security issues found (should block merge)

## Sample Output

### Success Case

```
✅ Semgrep Security Scan
No security issues found
ℹ️ 3 informational findings.
```

### Warning Case

```
⚠️ Semgrep Security Scan
Semgrep found 2 warning(s)
⚠️ 2 potential security issues found.
ℹ️ 1 informational findings.
Consider reviewing these warnings.
```

### Error Case

```
❌ Semgrep Security Scan
Semgrep found 1 critical security issue(s)
🚨 1 critical security issues found.
⚠️ 3 warnings.
ℹ️ 2 informational findings.
```

## Troubleshooting

### Common Issues

1. **Scan Timeout**: Large repositories may timeout. Consider excluding more paths or increasing timeout.
2. **Permission Issues**: Ensure the GitHub App has proper repository access permissions.
3. **False Positives**: Use `.semgrep.yml` to customize rules or add exceptions.

### Disabling Scans

To temporarily disable security scanning:

1. Comment out the webhook handlers in `src/handlers/webhooks.ts`
2. Or remove the Semgrep scanning logic while keeping the welcome comments

### Viewing Detailed Logs

Enable debug logging by setting `NODE_ENV=development` to see detailed scan information.

## Performance Considerations

- **Repository Size**: Large repositories (>100MB) may take longer to clone and scan
- **Rule Sets**: Using more comprehensive rule sets increases scan time
- **Concurrent Scans**: Multiple simultaneous pull requests will queue scans

## Security Notes

- The app never stores cloned repository data permanently
- Temporary directories are cleaned up after each scan
- GitHub App tokens are used securely for repository access
- Scan results are only visible to users with repository access

## Extending the Integration

### Adding Custom Rules

Edit `.semgrep.yml` to add project-specific security patterns:

```yaml
rules:
  - id: custom-security-rule
    patterns:
      - pattern: dangerous_function($X)
    message: Custom security violation detected
    languages: [javascript, typescript]
    severity: ERROR
```

### Modifying Scan Behavior

Key files to modify:

- `src/services/semgrep.ts`: Core scanning logic
- `src/handlers/webhooks.ts`: Webhook integration
- `.semgrep.yml`: Custom security rules
