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
 * CI Mode Renderer - Simple & Structured
 * Features: No spinners, plain text, clear section markers
 */
export class CiRenderer extends BaseRenderer {
  renderPhaseStart(phase: Phase): string {
    const phaseNames: Record<Phase, string> = {
      init: "Initializing",
      loading: "Loading configuration",
      collecting: "Processing features",
      applying: "Applying changes",
      complete: "Complete",
    };

    return `${phaseNames[phase]}`;
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
      if (feature.status === "complete") {
        lines.push(
          `  ${feature.name} (${feature.index + 1}/${feature.total}) ✓`,
        );
        if (this.verbosity === "verbose" && feature.logs.length > 0) {
          for (const log of feature.logs) {
            lines.push(`    • ${log}`);
          }
        }
      } else if (feature.status === "in-progress") {
        lines.push(
          `  ${feature.name} (${feature.index + 1}/${feature.total}) ${feature.message ?? ""}`,
        );
        if (this.verbosity === "verbose" && feature.logs.length > 0) {
          for (const log of feature.logs) {
            lines.push(`    • ${log}`);
          }
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
      generated: "✓",
      created: "+",
      updated: "↻",
      deleted: "-",
      skipped: "·",
    };

    const statusSymbols: Record<typeof op.status, string> = {
      success: "",
      conflict: " (conflict)",
      error: " (error)",
      "needs-review": " (needs-review)",
    };

    const symbol = symbols[op.operation];
    const statusSuffix = statusSymbols[op.status];
    const colorFn =
      op.status === "error"
        ? this.red.bind(this)
        : op.status === "needs-review" || op.status === "conflict"
          ? this.yellow.bind(this)
          : (text: string) => text;

    const detail = op.details ? ` ${op.details}` : "";
    return colorFn(`  ${symbol} ${op.path} [${op.operation}]${statusSuffix}${detail}`);
  }

  renderDependencyOperation(op: DependencyOperation): string {
    const symbols = {
      add: "+",
      remove: "-",
      update: "↻",
    };

    const versionStr = op.version ? `@${op.version}` : "";
    return `  ${symbols[op.type]} ${op.packageName}${versionStr}`;
  }

  renderSummary(summary: ApplySummary): string {
    const lines: string[] = [];

    lines.push("");
    lines.push(`Summary:`);
    lines.push(`  Features: ${summary.totalFeatures}`);
    const filesLine = [
      `  Files: ${summary.filesEvaluated} evaluated`,
      `${summary.filesChanged} changed`,
      `${summary.filesUnchanged} unchanged`,
    ].join(", ");
    lines.push(filesLine);
    const depsRemovedSuffix =
      summary.depsRemoved > 0 ? `, ${summary.depsRemoved} removed` : "";
    const depsLine = [
      `  Deps: ${summary.depsEvaluated} evaluated`,
      `${summary.depsChanged} changed`,
      `${summary.depsUnchanged} unchanged${depsRemovedSuffix}`,
    ].join(", ");
    lines.push(depsLine);
    lines.push(`  Packages: ${summary.packagesModified} touched`);

    if (summary.filesNeedingReview > 0) {
      lines.push(
        this.yellow(
          `⚠ ${summary.filesNeedingReview} file(s) require manual review`,
        ),
      );
    }

    if (summary.manualReviewItems.length > 0) {
      lines.push(this.yellow("Manual review required:"));
      for (const item of summary.manualReviewItems) {
        const managedBy =
          item.managedBy.length > 0
            ? ` (managed by ${item.managedBy.join(", ")})`
            : "";
        const message =
          item.message ? ` — ${item.message}` : "";
        lines.push(this.yellow(`  - ${item.path}${managedBy}${message}`));
      }
    }

    if (summary.errors.length > 0) {
      lines.push(this.red(`✗ ${summary.errors.length} error(s) occurred`));
      for (const error of summary.errors) {
        lines.push(this.red(`  ${error}`));
      }
    }

    const durationStr = (summary.duration / 1000).toFixed(1);
    lines.push(this.green(`✓ Complete in ${durationStr}s`));

    return lines.join("\n");
  }

  renderInfo(message: string): string {
    return `  ${message}`;
  }

  renderWarn(message: string): string {
    return this.yellow(`⚠ ${message}`);
  }

  renderError(message: string, error?: Error): string {
    const errorMsg = error ? `: ${error.message}` : "";
    return this.red(`✗ ${message}${errorMsg}`);
  }

  renderSuccess(message: string): string {
    return this.green(`✓ ${message}`);
  }
}
