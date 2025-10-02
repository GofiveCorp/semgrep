import type { App } from "octokit";

/**
 * Handles pull request opened events
 */
const handlePullRequestOpened = (messageForNewPRs: string) => {
  return async ({ octokit, payload }: any) => {
    console.log(
      `📩 Received pull request opened event for #${payload.pull_request.number}`
    );

    try {
      await octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.pull_request.number,
        body: messageForNewPRs,
      });

      console.log(`✅ Comment added to PR #${payload.pull_request.number}`);
    } catch (error: any) {
      console.error(
        `❌ Error adding comment to PR #${payload.pull_request.number}:`
      );
      if (error.response) {
        console.error(
          `Status: ${error.response.status}, Message: ${error.response.data.message}`
        );
      } else {
        console.error(error);
      }
    }
  };
};

/**
 * Handles pull request reopened events
 */
const handlePullRequestReopened = (messageForNewPRs: string) => {
  return async ({ octokit, payload }: any) => {
    console.log(
      `📩 Received pull request reopened event for #${payload.pull_request.number}`
    );

    try {
      await octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.pull_request.number,
        body: messageForNewPRs,
      });

      console.log(
        `✅ Comment added to reopened PR #${payload.pull_request.number}`
      );
    } catch (error: any) {
      console.error(
        `❌ Error adding comment to reopened PR #${payload.pull_request.number}:`
      );
      if (error.response) {
        console.error(
          `Status: ${error.response.status}, Message: ${error.response.data.message}`
        );
      } else {
        console.error(error);
      }
    }
  };
};

/**
 * General webhook event logger for debugging
 */
const handleAnyWebhookEvent = (event: any) => {
  console.log(`📩 Received webhook event: ${event.name}`);
  console.log(`📋 Payload:`, JSON.stringify(event.payload, null, 2));
};

/**
 * Handles webhook errors
 */
const handleWebhookError = (error: any) => {
  if (error.name === "AggregateError") {
    console.log(`❌ Error processing request: ${error.event}`);
  } else {
    console.log("❌ Webhook error:", error);
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

  console.log("🔧 Webhook handlers configured successfully");
};
