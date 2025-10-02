import { loadConfig } from "./config/index.js";
import { createGitHubApp, initializeGitHubApp } from "./services/github.js";
import { setupWebhookHandlers } from "./handlers/webhooks.js";
import { createWebhookServer } from "./services/server.js";

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    console.log("🚀 Starting GitHub App...");

    // Load configuration
    console.log("📋 Loading configuration...");
    const config = loadConfig();

    // Create GitHub App instance
    console.log("🔐 Creating GitHub App instance...");
    const app = createGitHubApp(config);

    // Initialize and authenticate the app
    console.log("🔑 Authenticating GitHub App...");
    await initializeGitHubApp(app);

    // Setup webhook handlers
    console.log("🎣 Setting up webhook handlers...");
    setupWebhookHandlers(app);

    // Start the webhook server
    console.log("🌐 Starting webhook server...");
    createWebhookServer(app, config.port);
  } catch (error) {
    console.error("💥 Failed to start application:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error("💥 Unhandled error in main:", error);
  process.exit(1);
});
