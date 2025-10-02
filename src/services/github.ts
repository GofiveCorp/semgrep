import { Octokit, App } from "octokit";
import { exec } from "child_process";
import { promisify } from "util";
import type { AppConfig } from "../types/index.js";
import { Logger } from "../utils/index.js";

const execAsync = promisify(exec);

/**
 * Creates and configures a GitHub App instance
 */
export const createGitHubApp = (config: AppConfig): App => {
  const app = new App({
    appId: config.appId,
    privateKey: config.privateKey,
    webhooks: {
      secret: config.secret,
    },
    ...(config.enterpriseHostname && {
      Octokit: Octokit.defaults({
        baseUrl: `https://${config.enterpriseHostname}/api/v3`,
      }),
    }),
  });

  return app;
};

/**
 * Initializes the GitHub App and logs authentication status
 */
export const initializeGitHubApp = async (app: App): Promise<void> => {
  try {
    // Get & log the authenticated app's name
    const { data } = await app.octokit.request("/app");

    // Read more about custom logging: https://github.com/octokit/core.js#logging
    app.octokit.log.debug(`Authenticated as '${data.name}'`);

    Logger.success(`GitHub App authenticated successfully as '${data.name}'`);
  } catch (error) {
    Logger.error("Failed to authenticate GitHub App:", error);
    throw error;
  }
};

/**
 * Clones a repository to a temporary directory using GitHub App authentication
 */
export const cloneRepository = async (
  octokit: InstanceType<typeof Octokit>,
  owner: string,
  repo: string,
  ref: string,
  targetDir: string
): Promise<void> => {
  try {
    Logger.info(
      `Cloning repository ${owner}/${repo} at ref ${ref} to ${targetDir}`
    );

    // Get installation access token for git operations
    const installationId = await getInstallationId(octokit, owner, repo);
    const { data: tokenData } =
      await octokit.rest.apps.createInstallationAccessToken({
        installation_id: installationId,
      });

    // Clone using the access token
    const cloneUrl = `https://x-access-token:${tokenData.token}@github.com/${owner}/${repo}.git`;
    const command = `git clone --branch ${ref} --single-branch --depth 1 ${cloneUrl} ${targetDir}`;

    await execAsync(command);
    Logger.success(`Successfully cloned repository to ${targetDir}`);
  } catch (error: any) {
    Logger.error(`Failed to clone repository ${owner}/${repo}:`, error);
    throw new Error(`Repository clone failed: ${error.message}`);
  }
};

/**
 * Gets the installation ID for a repository
 */
export const getInstallationId = async (
  octokit: InstanceType<typeof Octokit>,
  owner: string,
  repo: string
): Promise<number> => {
  try {
    const { data } = await octokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });
    return data.id;
  } catch (error) {
    Logger.error(`Failed to get installation ID for ${owner}/${repo}:`, error);
    throw error;
  }
};

/**
 * Posts Semgrep scan results as a GitHub comment with text output
 */
export const postSemgrepResultsComment = async (
  octokit: InstanceType<typeof Octokit>,
  owner: string,
  repo: string,
  prNumber: number,
  textOutput: string,
  findingsCount: number,
  eventType: "opened" | "reopened" = "opened"
): Promise<boolean> => {
  try {
    Logger.info(`Posting Semgrep results comment to PR #${prNumber}`);

    // Format text output for GitHub comment with proper markdown
    const commentBody = `🔍 **Semgrep Security Scan Results**

${
  findingsCount > 0
    ? `Found **${findingsCount}** potential security issue(s):

\`\`\`
${textOutput}
\`\`\``
    : "🎉 **No security issues found!** ✅"
}

*This scan was performed automatically when the pull request was ${eventType}.*
*Found issues? Check the [Semgrep documentation](https://semgrep.dev/docs/) for remediation guidance.*`;

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });

    Logger.success(`Posted Semgrep results comment to PR #${prNumber}`);
    return true;
  } catch (error: any) {
    Logger.error(`Failed to post comment to PR #${prNumber}:`, error);

    if (error.status === 403) {
      Logger.warning(
        `⚠️ Cannot post comment to ${owner}/${repo}: Missing 'issues: write' permission. ` +
          `Please update your GitHub App permissions to include 'Issues: Read & Write'.`
      );
    }

    return false;
  }
};

/**
 * Creates a GitHub check run for Semgrep results with fallback
 */
export const createCheckRun = async (
  octokit: InstanceType<typeof Octokit>,
  owner: string,
  repo: string,
  headSha: string,
  conclusion: "success" | "failure" | "neutral",
  title: string,
  summary: string,
  details?: string
): Promise<boolean> => {
  try {
    Logger.info(`Creating check run for ${owner}/${repo} at ${headSha}`);

    await octokit.rest.checks.create({
      owner,
      repo,
      name: "Semgrep Security Scan",
      head_sha: headSha,
      status: "completed",
      conclusion,
      output: {
        title,
        summary,
        text: details || summary,
      },
    });

    Logger.success(
      `Check run created successfully with conclusion: ${conclusion}`
    );
    return true;
  } catch (error: any) {
    if (error.status === 403) {
      Logger.warning(
        `⚠️ Cannot create check run for ${owner}/${repo}: Missing 'checks: write' permission. ` +
          `Please update your GitHub App permissions to include 'Checks: Read & Write' to enable status checks.`
      );
      Logger.info(
        `Visit https://github.com/settings/apps to update your GitHub App permissions.`
      );
    } else {
      Logger.error(`Failed to create check run for ${owner}/${repo}:`, error);
    }
    return false;
  }
};
