import type { App } from "octokit";
import { SemgrepService } from "../services/semgrep.js";
import {
  cloneRepository,
  createCheckRun,
  checkAppPermissions,
} from "../services/github.js";
import { Logger } from "../utils/index.js";

/**
 * Handles pull request opened events
 */
const handlePullRequestOpened = (messageForNewPRs: string) => {
  return async ({ octokit, payload }: any) => {
    const prNumber = payload.pull_request.number;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const headSha = payload.pull_request.head.sha;
    const branch = payload.pull_request.head.ref;

    Logger.webhook(`Received pull request opened event for #${prNumber}`);

    let tempDir: string | null = null;
    const semgrepService = new SemgrepService();

    try {
      // Check GitHub App permissions first
      const permissions = await checkAppPermissions(octokit, owner, repo);

      if (!permissions.hasContentsRead) {
        Logger.warning(
          `⚠️ Missing 'contents: read' permission for ${owner}/${repo}. Repository cloning may fail.`
        );
      }

      if (!permissions.hasIssuesWrite) {
        Logger.warning(
          `⚠️ Missing 'issues: write' permission for ${owner}/${repo}. Cannot post comments.`
        );
      }

      if (!permissions.hasChecksWrite) {
        Logger.warning(
          `⚠️ Missing 'checks: write' permission for ${owner}/${repo}. Status checks will not be created.`
        );
      }

      // Create initial comment if we have permission
      if (permissions.hasIssuesWrite) {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: messageForNewPRs,
        });

        Logger.success(`Welcome comment added to PR #${prNumber}`);
      } else {
        Logger.warning(
          `Skipping welcome comment for PR #${prNumber} due to missing permissions`
        );
      }

      // Create a pending check run if we have permission
      if (permissions.hasChecksWrite) {
        await octokit.rest.checks.create({
          owner,
          repo,
          name: "Semgrep Security Scan",
          head_sha: headSha,
          status: "in_progress",
          output: {
            title: "Semgrep scan in progress...",
            summary: "🔍 Scanning code for security vulnerabilities...",
          },
        });

        Logger.info(`Started Semgrep scan check run for PR #${prNumber}`);
      } else {
        Logger.info(
          `Starting Semgrep scan for PR #${prNumber} (status checks disabled due to missing permissions)`
        );
      }

      // Create temporary directory and clone repository
      tempDir = await semgrepService.createTempDirectory();
      await cloneRepository(octokit, owner, repo, branch, tempDir);

      // Run Semgrep scan
      const scanResult = await semgrepService.scanDirectory(tempDir, {
        config: "auto", // Use Semgrep Registry rules
        severity: ["ERROR", "WARNING"], // Focus on errors and warnings
        excludePaths: [
          "node_modules/*",
          "dist/*",
          "build/*",
          "*.min.js",
          "coverage/*",
          ".git/*",
        ],
        timeout: 300, // 5 minutes timeout
      });

      // Format results for GitHub comment
      const commentBody = semgrepService.formatFindingsForComment(
        scanResult.results
      );

      // Post scan results as a comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });

      // Create check run with results
      const checkStatus = semgrepService.getCheckRunStatus(scanResult.results);
      await createCheckRun(
        octokit,
        owner,
        repo,
        headSha,
        checkStatus.conclusion,
        checkStatus.title,
        checkStatus.summary,
        commentBody
      );

      Logger.success(
        `Semgrep scan completed for PR #${prNumber}. Found ${scanResult.results.length} findings.`
      );
    } catch (error: any) {
      Logger.error(`Error processing PR #${prNumber}:`, error);

      // Create failed check run
      try {
        await createCheckRun(
          octokit,
          owner,
          repo,
          headSha,
          "failure",
          "Semgrep scan failed",
          `❌ Semgrep security scan encountered an error: ${error.message}`,
          `The security scan could not be completed due to an error:\n\n\`\`\`\n${error.message}\n\`\`\``
        );
      } catch (checkError) {
        Logger.error(
          `Failed to create error check run for PR #${prNumber}:`,
          checkError
        );
      }

      // Post error comment
      try {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `🚨 **Semgrep Security Scan Failed**\n\nThe security scan encountered an error and could not be completed:\n\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease contact the maintainers if this issue persists.`,
        });
      } catch (commentError) {
        Logger.error(
          `Failed to post error comment to PR #${prNumber}:`,
          commentError
        );
      }
    } finally {
      // Cleanup temporary directory
      if (tempDir) {
        await semgrepService.cleanupTempDirectory(tempDir);
      }
    }
  };
};

/**
 * Handles pull request reopened events
 */
const handlePullRequestReopened = (messageForNewPRs: string) => {
  return async ({ octokit, payload }: any) => {
    const prNumber = payload.pull_request.number;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const headSha = payload.pull_request.head.sha;
    const branch = payload.pull_request.head.ref;

    Logger.webhook(`Received pull request reopened event for #${prNumber}`);

    let tempDir: string | null = null;
    const semgrepService = new SemgrepService();

    try {
      // Create reopened comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: messageForNewPRs,
      });

      Logger.success(`Welcome comment added to reopened PR #${prNumber}`);

      // Create a pending check run
      await octokit.rest.checks.create({
        owner,
        repo,
        name: "Semgrep Security Scan",
        head_sha: headSha,
        status: "in_progress",
        output: {
          title: "Semgrep scan in progress...",
          summary: "🔍 Re-scanning code for security vulnerabilities...",
        },
      });

      Logger.info(
        `Started Semgrep scan check run for reopened PR #${prNumber}`
      );

      // Create temporary directory and clone repository
      tempDir = await semgrepService.createTempDirectory();
      await cloneRepository(octokit, owner, repo, branch, tempDir);

      // Run Semgrep scan
      const scanResult = await semgrepService.scanDirectory(tempDir, {
        config: "auto",
        severity: ["ERROR", "WARNING"],
        excludePaths: [
          "node_modules/*",
          "dist/*",
          "build/*",
          "*.min.js",
          "coverage/*",
          ".git/*",
        ],
        timeout: 300,
      });

      // Format results for GitHub comment
      const commentBody = semgrepService.formatFindingsForComment(
        scanResult.results
      );

      // Post scan results as a comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });

      // Create check run with results
      const checkStatus = semgrepService.getCheckRunStatus(scanResult.results);
      await createCheckRun(
        octokit,
        owner,
        repo,
        headSha,
        checkStatus.conclusion,
        checkStatus.title,
        checkStatus.summary,
        commentBody
      );

      Logger.success(
        `Semgrep scan completed for reopened PR #${prNumber}. Found ${scanResult.results.length} findings.`
      );
    } catch (error: any) {
      Logger.error(`Error processing reopened PR #${prNumber}:`, error);

      // Create failed check run
      try {
        await createCheckRun(
          octokit,
          owner,
          repo,
          headSha,
          "failure",
          "Semgrep scan failed",
          `❌ Semgrep security scan encountered an error: ${error.message}`
        );
      } catch (checkError) {
        Logger.error(
          `Failed to create error check run for reopened PR #${prNumber}:`,
          checkError
        );
      }

      // Post error comment
      try {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `🚨 **Semgrep Security Scan Failed**\n\nThe security scan encountered an error and could not be completed:\n\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease contact the maintainers if this issue persists.`,
        });
      } catch (commentError) {
        Logger.error(
          `Failed to post error comment to reopened PR #${prNumber}:`,
          commentError
        );
      }
    } finally {
      // Cleanup temporary directory
      if (tempDir) {
        await semgrepService.cleanupTempDirectory(tempDir);
      }
    }
  };
};

/**
 * General webhook event logger for debugging
 */
const handleAnyWebhookEvent = (event: any) => {
  Logger.webhook(`Received webhook event: ${event.name}`);
  Logger.debug(`Payload:`, event.payload);
};

/**
 * Handles webhook errors
 */
const handleWebhookError = (error: any) => {
  if (error.name === "AggregateError") {
    Logger.error(`Error processing request: ${error.event}`);
  } else {
    Logger.error("Webhook error:", error);
  }
};

/**
 * Sets up all webhook event handlers
 */
export const setupWebhookHandlers = (
  app: App,
  messageForNewPRs: string
): void => {
  // Subscribe to pull request events
  app.webhooks.on(
    "pull_request.opened",
    handlePullRequestOpened(messageForNewPRs)
  );
  app.webhooks.on(
    "pull_request.reopened",
    handlePullRequestReopened(messageForNewPRs)
  );

  // Add general webhook listener for debugging
  app.webhooks.onAny(handleAnyWebhookEvent);

  // Handle webhook errors
  app.webhooks.onError(handleWebhookError);

  Logger.success("Webhook handlers configured successfully");
};
