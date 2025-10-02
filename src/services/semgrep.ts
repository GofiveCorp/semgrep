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
   * Runs Semgrep scan and returns text output for display
   */
  async scanDirectoryForTextOutput(
    targetPath: string,
    options: SemgrepScanOptions = {}
  ): Promise<{ jsonResult: SemgrepResult; textOutput: string }> {
    const {
      config = this.defaultConfig,
      severity = [],
      excludePaths = [],
      timeout = this.defaultTimeout,
    } = options;

    // Build Semgrep command for text output
    const tempDir = path.join(process.cwd(), "temp");
    await fs.promises.mkdir(tempDir, { recursive: true });
    const textOutputFile = path.join(tempDir, `semgrep-text-${Date.now()}.txt`);
    const jsonOutputFile = path.join(
      tempDir,
      `semgrep-json-${Date.now()}.json`
    );

    const semgrepArgsText = [
      "--config",
      config,
      "--no-git-ignore",
      "--timeout",
      timeout.toString(),
      "-o",
      textOutputFile,
    ];

    const semgrepArgsJson = [
      "--config",
      config,
      "--json",
      "--no-git-ignore",
      "--timeout",
      timeout.toString(),
      "-o",
      jsonOutputFile,
    ];

    // Add severity filters if specified
    if (severity.length > 0) {
      severity.forEach((sev) => {
        semgrepArgsText.push("--severity", sev);
        semgrepArgsJson.push("--severity", sev);
      });
    }

    // Add exclude paths if specified
    excludePaths.forEach((excludePath) => {
      semgrepArgsText.push("--exclude", excludePath);
      semgrepArgsJson.push("--exclude", excludePath);
    });

    // Add target path
    semgrepArgsText.push(targetPath);
    semgrepArgsJson.push(targetPath);

    const textCommand = `semgrep ${semgrepArgsText.join(" ")}`;
    const jsonCommand = `semgrep ${semgrepArgsJson.join(" ")}`;

    try {
      console.log(`🔍 Running Semgrep scan for text output: ${textCommand}`);
      console.log(`🔍 Running Semgrep scan for JSON output: ${jsonCommand}`);

      // Run both commands
      await Promise.all([
        execAsync(textCommand, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: timeout * 1000,
        }),
        execAsync(jsonCommand, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: timeout * 1000,
        }),
      ]);

      // Read both outputs
      const textOutput = await fs.promises.readFile(textOutputFile, "utf-8");
      const jsonData = await fs.promises.readFile(jsonOutputFile, "utf-8");
      const jsonResult: SemgrepResult = JSON.parse(jsonData);

      // Clean up output files
      try {
        await fs.promises.unlink(textOutputFile);
        await fs.promises.unlink(jsonOutputFile);
      } catch (cleanupError) {
        console.warn(`⚠️ Could not clean up output files`);
      }

      console.log(
        `✅ Semgrep scan completed. Found ${jsonResult.results.length} findings.`
      );

      return { jsonResult, textOutput };
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error("Semgrep CLI not found. Please install Semgrep first.");
      }

      if (error.signal === "SIGTERM") {
        throw new Error(`Semgrep scan timed out after ${timeout} seconds.`);
      }

      throw new Error(`Semgrep scan failed: ${error.message}`);
    }
  }

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
    const tempDir = path.join(process.cwd(), "temp");
    await fs.promises.mkdir(tempDir, { recursive: true });
    const outputFile = path.join(tempDir, `semgrep-output-${Date.now()}.txt`);

    const semgrepArgs = [
      "--config",
      config,
      "--json",
      "--no-git-ignore", // Include all files for comprehensive scanning
      "--timeout",
      timeout.toString(),
      "-o",
      outputFile,
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

      // Read results from output file
      let result: SemgrepResult;
      try {
        const outputData = await fs.promises.readFile(outputFile, "utf-8");
        result = JSON.parse(outputData);
        console.log(
          `✅ Semgrep scan completed. Found ${result.results.length} findings.`
        );
      } catch (fileError) {
        console.warn(`⚠️ Could not read output file, falling back to stdout`);
        result = JSON.parse(stdout);
        console.log(
          `✅ Semgrep scan completed (from stdout). Found ${result.results.length} findings.`
        );
      }

      // Clean up output file
      try {
        await fs.promises.unlink(outputFile);
      } catch (cleanupError) {
        console.warn(`⚠️ Could not clean up output file: ${outputFile}`);
      }

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

      // Try to read from output file if stdout parsing failed
      try {
        const outputData = await fs.promises.readFile(outputFile, "utf-8");
        const result: SemgrepResult = JSON.parse(outputData);
        console.log(
          `⚠️ Semgrep scan completed with findings (from file). Found ${result.results.length} issues.`
        );

        // Clean up output file
        try {
          await fs.promises.unlink(outputFile);
        } catch (cleanupError) {
          console.warn(`⚠️ Could not clean up output file: ${outputFile}`);
        }

        return result;
      } catch (fileError: any) {
        console.error("Failed to read output file:", fileError.message);
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
   * Sends Semgrep text output to external webhook or service
   */
  async sendToExternalService(
    textOutput: string,
    webhookUrl?: string,
    metadata?: {
      repository: string;
      pullRequest: number;
      branch: string;
      findingsCount: number;
    }
  ): Promise<boolean> {
    if (!webhookUrl) {
      console.log("📤 No webhook URL provided, logging output instead:");
      console.log("=".repeat(50));
      console.log(textOutput);
      console.log("=".repeat(50));
      return true;
    }

    try {
      console.log(
        `📤 Sending Semgrep results to external service: ${webhookUrl}`
      );

      const payload = {
        timestamp: new Date().toISOString(),
        source: "semgrep-github-app",
        scanResults: {
          textOutput,
          findingsCount: metadata?.findingsCount || 0,
        },
        repository: metadata?.repository,
        pullRequest: metadata?.pullRequest,
        branch: metadata?.branch,
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "semgrep-github-app/1.0",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`✅ Successfully sent results to external service`);
        return true;
      } else {
        console.error(
          `❌ Failed to send to external service: ${response.status} ${response.statusText}`
        );
        return false;
      }
    } catch (error: any) {
      console.error(`❌ Error sending to external service:`, error.message);
      return false;
    }
  }

  /**
   * Exports Semgrep text output to a file
   */
  async exportToFile(
    textOutput: string,
    filename?: string,
    directory?: string
  ): Promise<string> {
    const exportDir = directory || path.join(process.cwd(), "exports");
    await fs.promises.mkdir(exportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const exportFilename = filename || `semgrep-results-${timestamp}.txt`;
    const exportPath = path.join(exportDir, exportFilename);

    try {
      await fs.promises.writeFile(exportPath, textOutput, "utf-8");
      console.log(`📁 Exported Semgrep results to: ${exportPath}`);
      return exportPath;
    } catch (error: any) {
      console.error(`❌ Failed to export results to file:`, error.message);
      throw error;
    }
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
