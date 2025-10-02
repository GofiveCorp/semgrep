# GitHub App Permissions Setup Guide

This guide will help you configure the necessary permissions for your GitHub App to enable Semgrep security scanning.

## Required Permissions

Your GitHub App needs the following permissions to function properly:

### Repository Permissions

| Permission        | Access Level | Purpose                                                      |
| ----------------- | ------------ | ------------------------------------------------------------ |
| **Checks**        | Read & Write | ✅ Create and update status checks for security scan results |
| **Contents**      | Read         | ✅ Clone repository code for scanning                        |
| **Issues**        | Write        | ✅ Post comments with scan results on pull requests          |
| **Pull requests** | Read         | ✅ Access pull request information and events                |

### Webhook Events

| Event             | Required | Purpose                                             |
| ----------------- | -------- | --------------------------------------------------- |
| **Pull requests** | ✅       | Trigger security scans when PRs are opened/reopened |

## Step-by-Step Setup

### 1. Access Your GitHub App Settings

1. Go to [GitHub Developer Settings](https://github.com/settings/apps)
2. Find your GitHub App and click "Edit"

### 2. Configure Permissions

In the **Permissions & events** tab:

#### Repository permissions:

- **Checks**: Select "Read & Write"
- **Contents**: Select "Read"
- **Issues**: Select "Write"
- **Pull requests**: Select "Read"

#### Subscribe to events:

- ✅ Check "Pull requests"

### 3. Save Changes

1. Click "Save changes" at the bottom of the page
2. GitHub will show you the updated permissions

### 4. Update Installation

If your app is already installed on repositories:

1. Go to the repository where your app is installed
2. Navigate to **Settings** → **Integrations** → **GitHub Apps**
3. Find your app and click "Configure"
4. You should see a notification about updated permissions
5. Click "Accept new permissions" if prompted

### 5. Verify Setup

After updating permissions, test by:

1. Creating a new pull request in a repository where your app is installed
2. Check that the security scan runs and creates:
   - ✅ A status check called "Semgrep Security Scan"
   - ✅ Comments with scan results
   - ✅ No permission errors in the app logs

## Troubleshooting

### Common Issues

#### ❌ "Resource not accessible by integration" Error

**Problem**: Your app doesn't have the required permissions.

**Solution**:

1. Follow steps 1-4 above to update permissions
2. Make sure you accepted the new permissions on installed repositories

#### ❌ Status Checks Not Appearing

**Problem**: Missing "Checks: Read & Write" permission.

**Solution**:

1. Update the **Checks** permission to "Read & Write"
2. Re-accept permissions on installed repositories

#### ❌ Comments Not Posted

**Problem**: Missing "Issues: Write" permission.

**Solution**:

1. Update the **Issues** permission to "Write"
2. Re-accept permissions on installed repositories

#### ❌ Webhook Not Triggering

**Problem**: Missing "Pull requests" event subscription.

**Solution**:

1. Subscribe to "Pull requests" events in webhook settings
2. Verify webhook URL is correct and accessible

### Testing Your Setup

You can test if permissions are working by checking the app logs:

```bash
npm run dev
```

Look for these messages:

- ✅ `GitHub App authenticated successfully`
- ✅ `Webhook handlers configured successfully`
- ⚠️ If you see permission warnings, update your GitHub App settings

### Support

If you continue to have issues:

1. Check the [GitHub Apps documentation](https://docs.github.com/en/developers/apps)
2. Verify your webhook secret is correct
3. Ensure your app's private key is valid
4. Check repository installation status

## Security Notes

- Only grant the minimum permissions needed
- Regularly review and audit app permissions
- Use webhook secrets to verify request authenticity
- Keep your private key secure and never commit it to version control
