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
 * Quiet Mode Renderer - Minimal Output
 * Features: Single line with spinner in TTY, summary only
 */
export class QuietRenderer extends BaseRenderer {
  private currentLine = "";

  renderPhaseStart(phase: Phase): string {
    // Only show something meaningful at the start
    if (phase === "loading") {
      return "Applying configuration";
    }
    return "";
  }

  renderPhaseEnd(_phase: Phase, _result: PhaseResult): string {
    // Don't output anything for phase ends in quiet mode
    return "";
  }

  renderFeatureProgress(features: FeatureProgress[]): string {
    // Find the current in-progress feature
    const inProgress = features.find((f) => f.status === "in-progress");
    if (!inProgress) return "";

    const featureCount = features.length;
    const message = inProgress.message ? ` ${inProgress.message}` : "";
    this.currentLine = `(${featureCount} features) ${inProgress.name}${message}`;

    // In quiet mode, we don't output this directly
    // It will be shown by the spinner
    return "";
  }

  getCurrentLine(): string {
    return this.currentLine;
  }

  renderFileOperation(_op: FileOperation): string {
    // Don't output individual file operations in quiet mode
    return "";
  }

  renderDependencyOperation(_op: DependencyOperation): string {
    // Don't output individual dependency operations in quiet mode
    return "";
  }

  renderSummary(summary: ApplySummary): string {
    const parts: string[] = [];

    const featuresText = this.bold(
      this.cyan(`${summary.totalFeatures} features`),
    );
    const filesChangedText =
      summary.filesChanged > 0
        ? this.bold(this.green(`${summary.filesChanged} changed`))
        : this.dim(`${summary.filesChanged} changed`);
    const filesUnchangedText = this.dim(
      `${summary.filesUnchanged} unchanged`,
    );
    const depsChangedText =
      summary.depsChanged > 0
        ? this.bold(this.green(`${summary.depsChanged} changed`))
        : this.dim(`${summary.depsChanged} changed`);
    const depsUnchangedText = this.dim(
      `${summary.depsUnchanged} unchanged`,
    );

    const filesLine =
      `${summary.filesEvaluated} files (${filesChangedText}, ${filesUnchangedText})`;
    const depsLine =
      `${summary.depsEvaluated} deps (${depsChangedText}, ${depsUnchangedText})`;

    parts.push(featuresText);
    parts.push(filesLine);
    parts.push(depsLine);

    if (summary.depsRemoved > 0) {
      parts.push(this.red(`${summary.depsRemoved} removed`));
    }

    if (summary.filesNeedingReview > 0) {
      parts.push(this.yellow(`${summary.filesNeedingReview} needs review`));
    }

    const durationStr = (summary.duration / 1000).toFixed(1);
    const summaryLine =
      `${this.green("✓")} ${parts.join(", ")} (${durationStr}s)`;

    if (summary.manualReviewItems.length === 0) {
      return summaryLine;
    }

    const detailLines = summary.manualReviewItems.map((item) => {
      const managedBy =
        item.managedBy.length > 0
          ? ` (managed by ${item.managedBy.join(", ")})`
          : "";
      const message = item.message ? ` — ${item.message}` : "";
      return `  - ${item.path}${managedBy}${message}`;
    });

    return [
      summaryLine,
      this.yellow("⚠ Manual review required:"),
      ...detailLines,
    ].join("\n");
  }

  renderInfo(_message: string): string {
    // Don't output info messages in quiet mode
    return "";
  }

  renderWarn(message: string): string {
    // Show warnings even in quiet mode
    return this.yellow(`⚠ ${message}`);
  }

  renderError(message: string, error?: Error): string {
    // Always show errors
    const errorMsg = error ? `: ${error.message}` : "";
    return this.red(`✗ ${message}${errorMsg}`);
  }

  renderSuccess(_message: string): string {
    // Don't output success messages individually in quiet mode
    return "";
  }
}
