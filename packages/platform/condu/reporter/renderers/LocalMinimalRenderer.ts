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
 * Local Minimal Mode Renderer - Ultra Minimal (Option C)
 * Features: Colors, minimal formatting, clean output
 */
export class LocalMinimalRenderer extends BaseRenderer {
  renderPhaseStart(phase: Phase): string {
    const phaseNames: Record<Phase, string> = {
      init: "Initializing",
      loading: "Loading configuration",
      collecting: "Collecting state",
      applying: "Applying changes",
      complete: "Complete",
    };

    return `\n${this.bold(phaseNames[phase])}`;
  }

  renderPhaseEnd(_phase: Phase, result: PhaseResult): string {
    if (!result.success && result.error) {
      return this.red(`✗ Failed: ${result.error.message}`);
    }
    return "";
  }

  renderFeatureProgress(features: FeatureProgress[]): string {
    const lines: string[] = [];

    for (const feature of features) {
      const statusSymbol =
        feature.status === "complete"
          ? this.green("✓")
          : feature.status === "in-progress"
            ? "⠋"
            : this.gray("·");

      const messageStr =
        feature.status === "in-progress" && feature.message
          ? ` ${this.dim(feature.message)}`
          : "";

      const statsStr =
        feature.status === "complete" && feature.stats
          ? ` ${this.dim(`(${feature.stats.filesQueued} files, ${feature.stats.depsAdded} deps)`)}`
          : "";

      lines.push(`  ${statusSymbol} ${feature.name}${messageStr}${statsStr}`);

      if (this.verbosity === "verbose" && feature.logs.length > 0) {
        for (const log of feature.logs) {
          lines.push(`    ${this.dim("•")} ${log}`);
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

    const statusSymbols: Record<typeof op.status, string> = {
      success: "",
      conflict: this.yellow(" (conflict)"),
      error: this.red(" (error)"),
      "needs-review": this.yellow(" (needs-review)"),
    };

    const symbol = symbols[op.operation];
    const statusSuffix = statusSymbols[op.status];

    const pathDisplay =
      op.path.length > 60 ? `...${op.path.slice(-57)}` : op.path;

    const detail = op.details ? ` ${this.dim(op.details)}` : "";
    return `    ${symbol} ${this.dim(pathDisplay.padEnd(60))} ${this.gray(`[${op.operation}]`)}${statusSuffix}${detail}`;
  }

  renderDependencyOperation(op: DependencyOperation): string {
    const symbols = {
      add: this.green("+"),
      remove: this.red("-"),
      update: this.cyan("↻"),
    };

    const versionStr = op.version ? this.gray(`@${op.version}`) : "";
    return `    ${symbols[op.type]} ${op.packageName}${versionStr}`;
  }

  renderSummary(summary: ApplySummary): string {
    const lines: string[] = [];

    lines.push("");
    lines.push(this.bold("Summary"));

    const fileDetails: string[] = [];
    if (summary.filesCreated > 0)
      fileDetails.push(`${summary.filesCreated} new`);
    if (summary.filesUpdated > 0)
      fileDetails.push(`${summary.filesUpdated} updated`);
    if (summary.filesNeedingReview > 0)
      fileDetails.push(this.yellow(`${summary.filesNeedingReview} review`));
    if (summary.filesDeleted > 0)
      fileDetails.push(`${summary.filesDeleted} deleted`);

    const filesChangedText =
      summary.filesChanged > 0
        ? this.green(`${summary.filesChanged} changed`)
        : this.dim(`${summary.filesChanged} changed`);
    const filesUnchangedText = this.dim(
      `${summary.filesUnchanged} unchanged`,
    );
    const depsChangedText =
      summary.depsChanged > 0
        ? this.green(`${summary.depsChanged} changed`)
        : this.dim(`${summary.depsChanged} changed`);
    const depsUnchangedText = this.dim(
      `${summary.depsUnchanged} unchanged`,
    );

    lines.push(`  Features: ${summary.totalFeatures}`);
    const filesDetailSuffix =
      fileDetails.length > 0 ? ` (${fileDetails.join(", ")})` : "";
    const depsRemovedSuffix =
      summary.depsRemoved > 0
        ? ` · ${this.red(`${summary.depsRemoved} removed`)}`
        : "";

    const filesParts = [
      `Files: ${summary.filesEvaluated} evaluated`,
      filesChangedText,
      filesUnchangedText,
    ];
    const depsParts = [
      `Deps: ${summary.depsEvaluated} evaluated`,
      depsChangedText,
      depsUnchangedText,
    ];

    lines.push(`  ${filesParts.join(" · ")}${filesDetailSuffix}`);
    lines.push(`  ${depsParts.join(" · ")}${depsRemovedSuffix}`);
    lines.push(`  Packages: ${summary.packagesModified} touched`);

    if (summary.filesNeedingReview > 0) {
      lines.push(
        `  ${this.yellow("⚠")} ${summary.filesNeedingReview} file(s) need manual review`,
      );
    }

    if (summary.manualReviewItems.length > 0) {
      lines.push("");
      lines.push(this.yellow("Manual review required:"));
      for (const item of summary.manualReviewItems) {
        const managedBy =
          item.managedBy.length > 0
            ? this.dim(` (managed by ${item.managedBy.join(", ")})`)
            : "";
        lines.push(`  - ${item.path}${managedBy}`);
        if (item.message) {
          lines.push(`    ${this.dim(item.message)}`);
        }
      }
    }

    if (summary.errors.length > 0) {
      lines.push("");
      lines.push(this.red(`Errors (${summary.errors.length}):`));
      for (const error of summary.errors) {
        lines.push(this.red(`  ${error}`));
      }
    }

    if (summary.warnings.length > 0) {
      lines.push("");
      lines.push(this.yellow(`Warnings (${summary.warnings.length}):`));
      for (const warning of summary.warnings) {
        lines.push(this.yellow(`  ${warning}`));
      }
    }

    lines.push("");
    const durationStr = (summary.duration / 1000).toFixed(1);
    lines.push(this.green(`✓ Complete in ${durationStr}s`));

    return lines.join("\n");
  }

  renderInfo(message: string): string {
    return `  ${message}`;
  }

  renderWarn(message: string): string {
    return this.yellow(`  ⚠ ${message}`);
  }

  renderError(message: string, error?: Error): string {
    const errorMsg = error ? `\n  ${this.dim(error.message)}` : "";
    return this.red(`  ✗ ${message}${errorMsg}`);
  }

  renderSuccess(message: string): string {
    return this.green(`  ✓ ${message}`);
  }
}
