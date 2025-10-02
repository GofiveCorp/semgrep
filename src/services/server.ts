import http from "http";
import { createNodeMiddleware } from "@octokit/webhooks";
import type { App } from "octokit";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Creates and starts the HTTP server for webhook listening
 */
export const createWebhookServer = (app: App, port: string): http.Server => {
  const path = "/"; // Root path for Smee.io compatibility
  const localWebhookUrl = `http://localhost:${port}${path}`;

  console.log(`🔧 Setting up webhook listener at path: ${path}`);

  // Create middleware for handling webhooks
  const middleware = createNodeMiddleware(app.webhooks, { path });

  // Create HTTP server
  const server = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      console.log(`📨 Incoming request: ${req.method} ${req.url}`);
      console.log(`📋 Headers:`, req.headers);

      // Handle unhandled requests manually
      const originalEnd = res.end.bind(res);
      res.end = function (chunk?: any, encoding?: any) {
        if (res.statusCode === 404) {
          console.log(`📨 Unhandled request: ${req.method} ${req.url}`);
        }
        return originalEnd(chunk, encoding);
      };

      middleware(req, res);
    }
  );

  // Start listening
  server.listen(parseInt(port), () => {
    console.log(`🚀 Server is listening for events at: ${localWebhookUrl}`);
    console.log("Press Ctrl + C to quit.");
  });

  // Handle server errors
  server.on("error", (error) => {
    console.error("❌ Server error:", error);
  });

  return server;
};
