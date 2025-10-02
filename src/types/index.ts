export interface EnvironmentConfig {
  APP_ID: string;
  PRIVATE_KEY_PATH: string;
  WEBHOOK_SECRET: string;
  ENTERPRISE_HOSTNAME?: string;
  PORT?: string;
  SEMGREP_WEBHOOK_URL?: string;
  EXPORT_RESULTS?: string;
  SEMGREP_CONFIG?: string;
  SEMGREP_TIMEOUT?: string;
}

export interface AppConfig {
  appId: string;
  privateKey: string;
  secret: string;
  enterpriseHostname?: string;
  port: string;
  messageForNewPRs: string;
  // Semgrep configuration
  semgrepWebhookUrl?: string;
  exportResults: boolean;
  semgrepConfig: string;
  semgrepTimeout: number;
}
