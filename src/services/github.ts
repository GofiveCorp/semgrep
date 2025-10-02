import { Octokit, App } from "octokit";
import type { AppConfig } from "../types/index.js";
import { Logger } from "../utils/index.js";

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
