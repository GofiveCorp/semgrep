import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export interface SemgrepFinding {
  check_id: string;
  path: string;
  start: {
    line: number;
    col: number;
    offset?: number;
  };
  end: {
    line: number;
    col: number;
    offset?: number;
  };
  extra: {
    message: string;
    severity: "ERROR" | "WARNING" | "INFO";
    metadata?: {
      cwe?: string[];
      owasp?: string[];
      category?: string;
      technology?: string[];
      subcategory?: string[];
      likelihood?: string;
      impact?: string;
      confidence?: string;
      references?: string[];
      license?: string;
      vulnerability_class?: string[];
      source?: string;
      shortlink?: string;
      "semgrep.dev"?: any;
    };
    metavars?: Record<string, any>;
  };
  fingerprint?: string;
  lines?: string;
  is_ignored?: boolean;
  validation_state?: string;
  dataflow_trace?: any;
  engine_kind?: string;
}

export interface SemgrepResult {
  results: SemgrepFinding[];
  errors: any[];
  paths: {
    scanned: string[];
  };
}

export interface SemgrepScanOptions {
  config?: string;
  outputFormat?: "json" | "text" | "sarif";
  severity?: string[];
  excludePaths?: string[];
  timeout?: number;
}

/**
 * Service for running Semgrep scans
 */
export class SemgrepService {
  private readonly defaultConfig = "auto"; // Uses Semgrep Registry rules
  private readonly defaultTimeout = 300; // 5 minutes

  /**
   * Runs Semgrep scan on a directory
   */
  async scanDirectory(
    targetPath: string,
    options: SemgrepScanOptions = {}
  ): Promise<SemgrepResult> {
    const {
      config = this.defaultConfig,
      outputFormat = "json",
      severity = [],
      excludePaths = [],
      timeout = this.defaultTimeout,
    } = options;

    // Build Semgrep command
    const semgrepArgs = [
      "--config",
      config,
      "--json",
      "--no-git-ignore", // Include all files for comprehensive scanning
      "--timeout",
      timeout.toString(),
    ];

    // Add severity filters if specified
    if (severity.length > 0) {
      severity.forEach((sev) => {
        semgrepArgs.push("--severity", sev);
      });
    }

    // Add exclude paths if specified
    excludePaths.forEach((excludePath) => {
      semgrepArgs.push("--exclude", excludePath);
    });

    // Add target path
    semgrepArgs.push(targetPath);

    const command = `semgrep ${semgrepArgs.join(" ")}`;

    try {
      console.log(`🔍 Running Semgrep scan: ${command}`);
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        timeout: timeout * 1000, // Convert to milliseconds
      });

      if (stderr && !stderr.includes("WARNING")) {
        console.warn(`⚠️ Semgrep warnings: ${stderr}`);
      }
      console.log(`✅ RAW Semgrep scan completed. Found ${stdout} findings.`);

      const result: SemgrepResult = JSON.parse(stdout);
      console.log(
        `✅ Semgrep scan completed. Found ${result.results.length} findings.`
      );

      return result;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error("Semgrep CLI not found. Please install Semgrep first.");
      }

      if (error.signal === "SIGTERM") {
        throw new Error(`Semgrep scan timed out after ${timeout} seconds.`);
      }

      // Try to parse JSON output even if command failed (Semgrep returns findings with non-zero exit codes)
      if (error.stdout) {
        try {
          const result: SemgrepResult = JSON.parse(error.stdout);
          console.log(
            `⚠️ Semgrep scan completed with findings. Found ${result.results.length} issues.`
          );
          return result;
        } catch (parseError) {
          console.error("Failed to parse Semgrep output:", error.stdout);
        }
      }

      throw new Error(`Semgrep scan failed: ${error.message}`);
    }
  }

  /**
   * Formats Semgrep findings for GitHub comment
   */
  formatFindingsForComment(findings: SemgrepFinding[]): string {
    console.log(`📝 Formatting ${findings.length} findings for comment...`);

    if (findings.length === 0) {
      console.log("ℹ️ No findings to format");
      return "🎉 **Semgrep Security Scan Results**\n\nNo security issues found! ✅";
    }

    // Debug: Log each finding briefly
    findings.forEach((finding, index) => {
      console.log(
        `Finding ${index + 1}: ${finding.check_id} (${
          finding.extra.severity
        }) in ${finding.path}:${finding.start.line}`
      );
    });

    const severityEmojis = {
      ERROR: "🚨",
      WARNING: "⚠️",
      INFO: "ℹ️",
    };

    let comment = `🔍 **Semgrep Security Scan Results**\n\nFound ${findings.length} potential security issue(s):\n\n`;

    // Group findings by severity
    const groupedFindings = findings.reduce((acc, finding) => {
      const severity = finding.extra.severity;
      if (!acc[severity]) {
        acc[severity] = [];
      }
      acc[severity].push(finding);
      return acc;
    }, {} as Record<string, SemgrepFinding[]>);

    console.log(`📊 Grouped findings:`, {
      ERROR: groupedFindings.ERROR?.length || 0,
      WARNING: groupedFindings.WARNING?.length || 0,
      INFO: groupedFindings.INFO?.length || 0,
    });

    // Display findings by severity (ERROR, WARNING, INFO)
    const severityOrder: Array<keyof typeof severityEmojis> = [
      "ERROR",
      "WARNING",
      "INFO",
    ];

    severityOrder.forEach((severity) => {
      const severityFindings = groupedFindings[severity];
      if (severityFindings && severityFindings.length > 0) {
        comment += `### ${severityEmojis[severity]} ${severity} (${severityFindings.length})\n\n`;

        severityFindings.forEach((finding, index) => {
          // Basic finding info
          comment += `#### ${index + 1}. ${finding.check_id}\n\n`;
          comment += `📁 **File:** \`${finding.path}\`\n`;
          comment += `📍 **Line:** ${finding.start.line}${
            finding.end.line !== finding.start.line
              ? `-${finding.end.line}`
              : ""
          }\n`;

          // Main message - use extra.message
          const mainMessage = finding.extra.message;
          // Truncate very long messages to keep comments manageable
          const truncatedMessage =
            mainMessage.length > 200
              ? mainMessage.substring(0, 200) + "..."
              : mainMessage;
          comment += `💬 **Issue:** ${truncatedMessage}\n\n`;

          // Show the problematic code if available
          if (finding.lines) {
            const codeLines = finding.lines.trim();
            if (codeLines.length > 0) {
              comment += `**Code:**\n\`\`\`${this.getLanguageFromPath(
                finding.path
              )}\n${codeLines}\n\`\`\`\n\n`;
            }
          }

          // Add compact metadata
          const metadata = finding.extra?.metadata;
          if (metadata) {
            const metaParts: string[] = [];

            // CWE and OWASP (most important)
            if (metadata.cwe && metadata.cwe.length > 0) {
              metaParts.push(`🔗 **CWE:** ${metadata.cwe[0]}`); // Show only first CWE to save space
            }

            if (metadata.owasp && metadata.owasp.length > 0) {
              metaParts.push(`🛡️ **OWASP:** ${metadata.owasp[0]}`); // Show only first OWASP to save space
            }

            // Risk assessment in compact format
            if (metadata.confidence || metadata.impact || metadata.likelihood) {
              const riskParts = [];
              if (metadata.confidence)
                riskParts.push(`Confidence: ${metadata.confidence}`);
              if (metadata.impact) riskParts.push(`Impact: ${metadata.impact}`);
              if (metadata.likelihood)
                riskParts.push(`Likelihood: ${metadata.likelihood}`);
              if (riskParts.length > 0) {
                metaParts.push(`📊 **Risk:** ${riskParts.join(", ")}`);
              }
            }

            // Documentation link
            if (metadata.shortlink) {
              metaParts.push(`📚 [Learn more](${metadata.shortlink})`);
            } else if (metadata.source) {
              metaParts.push(`📚 [Learn more](${metadata.source})`);
            }

            if (metaParts.length > 0) {
              comment += metaParts.join(" | ") + "\n\n";
            }
          }

          comment += `\n---\n\n`;
        });
      }
    });

    comment += `*This scan was performed automatically when the pull request was opened.*\n`;
    comment += `*Found issues? Check the [Semgrep documentation](https://semgrep.dev/docs/) for remediation guidance.*`;

    return comment;
  }

  /**
   * Helper function to determine language for code blocks
   */
  private getLanguageFromPath(filePath: string): string {
    const extension = filePath.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      go: "go",
      php: "php",
      rb: "ruby",
      cs: "csharp",
      cpp: "cpp",
      c: "c",
      sh: "bash",
      yaml: "yaml",
      yml: "yaml",
      json: "json",
      xml: "xml",
      html: "html",
      css: "css",
      sql: "sql",
    };

    return languageMap[extension || ""] || "text";
  }

  /**
   * Creates GitHub check run status based on Semgrep results
   */
  getCheckRunStatus(findings: SemgrepFinding[]): {
    conclusion: "success" | "failure" | "neutral";
    title: string;
    summary: string;
  } {
    const errorCount = findings.filter(
      (f) => f.extra.severity === "ERROR"
    ).length;
    const warningCount = findings.filter(
      (f) => f.extra.severity === "WARNING"
    ).length;
    const infoCount = findings.filter(
      (f) => f.extra.severity === "INFO"
    ).length;

    if (errorCount > 0) {
      return {
        conclusion: "failure",
        title: `Semgrep found ${errorCount} critical security issue(s)`,
        summary: `🚨 **${errorCount}** critical security issues found.\n⚠️ **${warningCount}** warnings.\nℹ️ **${infoCount}** informational findings.`,
      };
    }

    if (warningCount > 0) {
      return {
        conclusion: "neutral",
        title: `Semgrep found ${warningCount} warning(s)`,
        summary: `⚠️ **${warningCount}** potential security issues found.\nℹ️ **${infoCount}** informational findings.\n\nConsider reviewing these warnings.`,
      };
    }

    return {
      conclusion: "success",
      title: "No security issues found",
      summary: `✅ Semgrep scan completed successfully.\nℹ️ **${infoCount}** informational findings.`,
    };
  }

  /**
   * Creates a temporary directory for cloning and scanning
   */
  async createTempDirectory(): Promise<string> {
    const tempDir = path.join(process.cwd(), "temp", `semgrep-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Cleans up temporary directory
   */
  async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temporary directory: ${tempDir}`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to cleanup temporary directory ${tempDir}:`,
        error
      );
    }
  }
}
