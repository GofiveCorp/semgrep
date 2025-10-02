/**
 * Logger utility with consistent formatting
 */
export class Logger {
  static info(message: string, data?: any): void {
    console.log(`ℹ️  ${message}`, data ? data : "");
  }

  static success(message: string, data?: any): void {
    console.log(`✅ ${message}`, data ? data : "");
  }

  static warning(message: string, data?: any): void {
    console.warn(`⚠️  ${message}`, data ? data : "");
  }

  static error(message: string, error?: any): void {
    console.error(`❌ ${message}`, error ? error : "");
  }

  static debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === "development") {
      console.log(`🐛 ${message}`, data ? data : "");
    }
  }

  static webhook(message: string, data?: any): void {
    console.log(`📩 ${message}`, data ? data : "");
  }

  static server(message: string, data?: any): void {
    console.log(`🌐 ${message}`, data ? data : "");
  }
}

/**
 * Utility functions for common operations
 */
export const Utils = {
  /**
   * Safely parse JSON with error handling
   */
  safeJsonParse: (jsonString: string): any => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      Logger.error("Failed to parse JSON", error);
      return null;
    }
  },

  /**
   * Format webhook event name for display
   */
  formatEventName: (eventName: string): string => {
    return eventName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  },

  /**
   * Create a timeout promise
   */
  timeout: (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
