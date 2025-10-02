import dotenv from "dotenv";
import fs from "fs";
import type { AppConfig } from "../types/index.js";

// Load environment variables from .env file
dotenv.config();

/**
 * Validates that an environment variable exists and returns its value
 */
const validateEnvVar = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

/**
 * Reads a file with error handling
 */
const readFileWithErrorHandling = (
  filePath: string,
  description: string
): string => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read ${description} from ${filePath}: ${error}`);
  }
};

/**
 * Loads and validates all application configuration
 */
export const loadConfig = (): AppConfig => {
  const appId = validateEnvVar("APP_ID", process.env.APP_ID);
  const privateKeyPath = validateEnvVar(
    "PRIVATE_KEY_PATH",
    process.env.PRIVATE_KEY_PATH
  );
  const secret = validateEnvVar("WEBHOOK_SECRET", process.env.WEBHOOK_SECRET);
  const enterpriseHostname = process.env.ENTERPRISE_HOSTNAME;
  const port = process.env.PORT || "3000";

  const privateKey = readFileWithErrorHandling(privateKeyPath, "private key");
  const messageForNewPRs = readFileWithErrorHandling(
    "./message.md",
    "message template"
  );

  return {
    appId,
    privateKey,
    secret,
    enterpriseHostname,
    port,
    messageForNewPRs,
    // Semgrep configuration
    semgrepWebhookUrl: process.env.SEMGREP_WEBHOOK_URL,
    exportResults: process.env.EXPORT_RESULTS === "true",
    semgrepConfig: process.env.SEMGREP_CONFIG || "auto",
    semgrepTimeout: parseInt(process.env.SEMGREP_TIMEOUT || "300"),
  };
};
