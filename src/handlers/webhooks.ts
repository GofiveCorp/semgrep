import type { App } from "octokit";
import { SemgrepService } from "../services/semgrep.js";
import {
  cloneRepository,
  createCheckRun,
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

      // Post scan results as a comment using the new function
      await postSemgrepResultsComment(
        octokit,
        owner,
        repo,
        prNumber,
        textOutput,
        scanResult.results.length,
        eventType
      );

      // Create check run with results if we have permission
      const checkStatus = semgrepService.getCheckRunStatus(scanResult.results);
      await createCheckRun(
        octokit,
        owner,
        repo,
        headSha,
        "success",
        checkStatus.title,
        checkStatus.summary,
        textOutput // Use text output instead of formatted comment
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
