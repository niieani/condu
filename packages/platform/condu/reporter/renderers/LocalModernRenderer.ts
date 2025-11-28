import type {
  ApplySummary,
  DependencyOperation,
  FeatureProgress,
  FileOperation,
  Phase,
  PhaseResult,
} from "../types.js";
import { BaseRenderer } from "./BaseRenderer.js";

/**
 * Local Modern Mode Renderer - Modern Minimalist (Option A)
 * Features: Tree-style structure, full color, detailed output
 */
export class LocalModernRenderer extends BaseRenderer {
  renderPhaseStart(phase: Phase): string {
    const phaseNames: Record<Phase, string> = {
      init: "condu apply",
      loading: "Loading configuration...",
      collecting: "Collecting state",
      applying: "Applying changes",
      complete: "",
    };

    if (phase === "init") {
      return `\n${this.bold("┌─")} ${phaseNames[phase]}`;
    }
    if (phase === "complete") {
      return "";
    }
    return `${this.bold("│")}\n${this.bold("├─")} ${phaseNames[phase]}`;
  }

  renderPhaseEnd(_phase: Phase, result: PhaseResult): string {
    if (!result.success && result.error) {
      return `${this.bold("│")}  ${this.red("✗")} ${this.red(result.error.message)}`;
    }
    return "";
  }

  renderFeatureProgress(features: FeatureProgress[]): string {
    const lines: string[] = [];
    lines.push(`${this.bold("│")}  Feature Pipeline:`);

    for (const feature of features) {
      const statusSymbol =
        feature.status === "complete"
          ? this.green("✓")
          : feature.status === "in-progress"
            ? "⠋"
            : this.gray("○");

      const messageStr =
        feature.status === "in-progress" && feature.message
          ? ` ${this.dim(feature.message)}`
          : "";

      const statsStr =
        feature.status === "complete" && feature.stats
          ? this.dim(
              ` (${feature.stats.filesQueued} files, ${feature.stats.depsAdded} deps)`,
            )
          : "";

      lines.push(
        `${this.bold("│")}  ${statusSymbol} ${feature.name.padEnd(18)}${messageStr}${statsStr}`,
      );

      if (this.verbosity === "verbose" && feature.logs.length > 0) {
        for (const log of feature.logs) {
          lines.push(`${this.bold("│")}    ${this.dim("•")} ${log}`);
        }
      }
    }

    return lines.join("\n");
  }

  renderFileOperation(op: FileOperation): string {
    if (this.verbosity !== "verbose" && op.operation === "skipped") {
      return "";
    }

    const symbols: Record<typeof op.operation, string> = {
      generated: this.green("✓"),
      created: this.green("+"),
      updated: this.cyan("↻"),
      deleted: this.red("-"),
      skipped: this.gray("·"),
    };

    const statusTags: Record<typeof op.status, string> = {
      success: "",
      conflict: this.yellow(" [conflict]"),
      error: this.red(" [error]"),
      "needs-review": this.yellow(" [needs review]"),
    };

    const symbol = symbols[op.operation];
    const statusTag = statusTags[op.status];
    const operation = this.gray(`[${op.operation}]`);

    const pathDisplay =
      op.path.length > 55 ? `...${op.path.slice(-52)}` : op.path;

    const detail = op.details ? ` ${this.dim(op.details)}` : "";
    return `${this.bold("│")}  ${symbol} ${pathDisplay.padEnd(55)} ${operation}${statusTag}${detail}`;
  }

  renderDependencyOperation(op: DependencyOperation): string {
    const symbols = {
      add: this.green("+"),
      remove: this.red("-"),
      update: this.cyan("↻"),
    };

    const versionStr = op.version ? this.gray(`@${op.version}`) : "";
    return `${this.bold("│")}  ${symbols[op.type]} ${op.packageName}${versionStr}`;
  }

  renderSummary(summary: ApplySummary): string {
    const lines: string[] = [];

    lines.push(`${this.bold("│")}`);

    // Stats line
    const stats = `${summary.packagesModified} packages modified, ${summary.totalFiles} files processed`;
    lines.push(`${this.bold("│")}  ${this.dim(stats)}`);

    lines.push(`${this.bold("│")}`);

    const durationStr = (summary.duration / 1000).toFixed(1);
    lines.push(
      `${this.bold("└─")} ${this.green("✓")} ${this.bold(`Complete in ${durationStr}s`)}`,
    );

    if (summary.manualReviewItems.length > 0) {
      lines.push("");
      lines.push(
        `${this.bold("│")}  ${this.yellow("Manual review required:")}`,
      );
      for (const item of summary.manualReviewItems) {
        const managedBy =
          item.managedBy.length > 0
            ? this.dim(` (managed by ${item.managedBy.join(", ")})`)
            : "";
        lines.push(`${this.bold("│")}    - ${item.path}${managedBy}`);
        if (item.message) {
          lines.push(`${this.bold("│")}      ${this.dim(item.message)}`);
        }
      }
    }

    // Warnings/Errors section
    if (summary.errors.length > 0) {
      lines.push("");
      lines.push(`   ${this.red("✗")} ${this.bold("Errors:")}`);
      for (const error of summary.errors) {
        lines.push(`   ${this.red("•")} ${error}`);
      }
    }

    return lines.join("\n");
  }

  renderInfo(message: string): string {
    return `${this.bold("│")}  ${message}`;
  }

  renderWarn(message: string): string {
    return `${this.bold("│")}  ${this.yellow("⚠")} ${message}`;
  }

  renderError(message: string, error?: Error): string {
    const errorMsg = error
      ? `\n${this.bold("│")}  ${this.dim(error.message)}`
      : "";
    return `${this.bold("│")}  ${this.red("✗")} ${message}${errorMsg}`;
  }

  renderSuccess(message: string): string {
    return `${this.bold("│")}  ${this.green("✓")} ${message}`;
  }
}
