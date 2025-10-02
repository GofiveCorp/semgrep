import type { App } from "octokit";
import { SemgrepService } from "../services/semgrep.js";
import {
  cloneRepository,
  createCheckRun,
  checkAppPermissions,
  postSemgrepResultsComment,
} from "../services/github.js";
import { Logger } from "../utils/index.js";

/**
 * Handles pull request scanning (shared logic for opened and reopened)
 */
const handlePullRequestScan = (eventType: "opened") => {
  return async ({ octokit, payload }: any) => {
    const prNumber = payload.pull_request.number;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const headSha = payload.pull_request.head.sha;
    const branch = payload.pull_request.head.ref;

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

      if (!true) {
        Logger.warning(
          `⚠️ Missing 'issues: write' permission for ${owner}/${repo}. Cannot post comments.`
        );
      }

      if (!permissions.hasChecksWrite) {
        Logger.warning(
          `⚠️ Missing 'checks: write' permission for ${owner}/${repo}. Status checks will not be created.`
        );
        Logger.info(
          `To enable status checks, visit https://github.com/settings/apps and grant 'Checks: Read & Write' permission to your GitHub App.`
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

        Logger.info(
          `Started Semgrep scan check run for ${eventType} PR #${prNumber}`
        );
      } else {
        Logger.info(
          `Starting Semgrep scan for ${eventType} PR #${prNumber} (status checks disabled due to missing permissions)`
        );
      }

      // Create temporary directory and clone repository
      tempDir = await semgrepService.createTempDirectory();
      await cloneRepository(octokit, owner, repo, branch, tempDir);

      // Run Semgrep scan with text output
      const { jsonResult: scanResult, textOutput } =
        await semgrepService.scanDirectoryForTextOutput(tempDir, {
          config: "auto", // Use Semgrep Registry rules
          severity: ["ERROR", "WARNING", "INFO"], // Include all severity levels
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

      // Format text output for GitHub comment
      Logger.info(
        `Formatting ${scanResult.results.length} findings for comment...`
      );

      // Debug: Log finding details
      scanResult.results.forEach((finding, index) => {
        Logger.debug(
          `Finding ${index + 1}: ${finding.check_id} in ${finding.path}:${
            finding.start.line
          } (severity: ${finding.extra.severity})`
        );
      });

      // Use text output for comment with markdown formatting
      const commentBody = `🔍 **Semgrep Security Scan Results**

${
  textOutput.length > 0
    ? `\`\`\`\n${textOutput}\n\`\`\``
    : "🎉 No security issues found! ✅"
}

*This scan was performed automatically when the pull request was ${eventType}.*
*Found issues? Check the [Semgrep documentation](https://semgrep.dev/docs/) for remediation guidance.*`;

      Logger.info(
        `Generated comment body length: ${commentBody.length} characters`
      );
      Logger.debug(`Comment preview: ${commentBody.substring(0, 200)}...`);

      // Post scan results as a comment using the new function
      if (true) {
        const commentPosted = await postSemgrepResultsComment(
          octokit,
          owner,
          repo,
          prNumber,
          textOutput,
          scanResult.results.length,
          eventType
        );

        if (commentPosted) {
          Logger.success(`Posted scan results comment to PR #${prNumber}`);
        } else {
          Logger.warning(`Failed to post comment to PR #${prNumber}`);
          // Log results to console as fallback
          Logger.info(
            `Semgrep scan results for PR #${prNumber}:\n${textOutput}`
          );
        }
      } else {
        Logger.warning(
          `Cannot post scan results to PR #${prNumber} due to missing 'issues: write' permission`
        );
        // Log results to console as fallback
        Logger.info(`Semgrep scan results for PR #${prNumber}:\n${textOutput}`);
      }

      // Create check run with results if we have permission
      if (permissions.hasChecksWrite) {
        const checkStatus = semgrepService.getCheckRunStatus(
          scanResult.results
        );
        const checkCreated = await createCheckRun(
          octokit,
          owner,
          repo,
          headSha,
          checkStatus.conclusion,
          checkStatus.title,
          checkStatus.summary,
          textOutput // Use text output instead of formatted comment
        );

        if (checkCreated) {
          Logger.success(
            `Check run created for PR #${prNumber} with conclusion: ${checkStatus.conclusion}`
          );
        }
      } else {
        const checkStatus = semgrepService.getCheckRunStatus(
          scanResult.results
        );
        Logger.info(
          `Scan completed for PR #${prNumber}: ${checkStatus.title} (status checks disabled)`
        );
      }

      Logger.success(
        `Semgrep scan completed for ${eventType} PR #${prNumber}. Found ${scanResult.results.length} findings.`
      );

      // Send results to external service or export to file (optional)
      const webhookUrl = process.env.SEMGREP_WEBHOOK_URL;
      if (webhookUrl) {
        await semgrepService.sendToExternalService(textOutput, webhookUrl, {
          repository: `${owner}/${repo}`,
          pullRequest: prNumber,
          branch,
          findingsCount: scanResult.results.length,
        });
      }

      // Optionally export to file for archival purposes
      if (process.env.EXPORT_RESULTS === "true") {
        await semgrepService.exportToFile(
          textOutput,
          `${owner}-${repo}-pr-${prNumber}-${Date.now()}.txt`
        );
      }
    } catch (error: any) {
      Logger.error(`Error processing ${eventType} PR #${prNumber}:`, error);

      // Create failed check run if we have permission
      const permissions = await checkAppPermissions(octokit, owner, repo);
      if (permissions.hasChecksWrite) {
        try {
          const checkCreated = await createCheckRun(
            octokit,
            owner,
            repo,
            headSha,
            "failure",
            "Semgrep scan failed",
            `❌ Semgrep security scan encountered an error: ${error.message}`,
            `The security scan could not be completed due to an error:\n\n\`\`\`\n${error.message}\n\`\`\``
          );

          if (checkCreated) {
            Logger.info(`Error check run created for PR #${prNumber}`);
          }
        } catch (checkError) {
          Logger.error(
            `Failed to create error check run for PR #${prNumber}:`,
            checkError
          );
        }
      }

      // Post error comment if we have permission
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
export const setupWebhookHandlers = (app: App): void => {
  // Subscribe to pull request events
  app.webhooks.on("pull_request.opened", handlePullRequestScan("opened"));
  // Handle webhook errors
  app.webhooks.onError(handleWebhookError);

  Logger.success("Webhook handlers configured successfully");
};
