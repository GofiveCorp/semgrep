export interface EnvironmentConfig {
  APP_ID: string;
  PRIVATE_KEY_PATH: string;
  WEBHOOK_SECRET: string;
  ENTERPRISE_HOSTNAME?: string;
  PORT?: string;
}

export interface AppConfig {
  appId: string;
  privateKey: string;
  secret: string;
  enterpriseHostname?: string;
  port: string;
  messageForNewPRs: string;
}
