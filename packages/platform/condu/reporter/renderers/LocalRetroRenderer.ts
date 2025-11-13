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
 * Local Retro Mode Renderer - Retro Terminal (Option B)
 * Features: Bold headers, progress bars, classic terminal aesthetics
 */
export class LocalRetroRenderer extends BaseRenderer {
  private currentPhaseNumber = 0;
  private readonly phaseCount = 4;

  renderPhaseStart(phase: Phase): string {
    const lines: string[] = [];

    if (phase === "init") {
      const border =
        "╔═══════════════════════════════════════════════════════════════════╗";
      const title =
        "║ 🖥  CONDU APPLY                                                   ║";
      const bottomBorder =
        "╚═══════════════════════════════════════════════════════════════════╝";

      lines.push("");
      lines.push(this.cyan(border));
      lines.push(this.cyan(title));
      lines.push(this.cyan(bottomBorder));
      lines.push("");
      return lines.join("\n");
    }

    const phaseNames: Record<Phase, string> = {
      init: "INITIALIZATION",
      loading: "INITIALIZATION",
      collecting: "COLLECTING STATE",
      applying: "APPLYING CHANGES",
      complete: "RESULT",
    };

    const phaseNumbers: Record<Phase, number> = {
      init: 0,
      loading: 1,
      collecting: 2,
      applying: 3,
      complete: 4,
    };

    this.currentPhaseNumber = phaseNumbers[phase];

    if (phase === "complete") {
      lines.push("");
      lines.push(
        this.bold(
          this.green(
            `▸▸▸ PHASE ${this.currentPhaseNumber}: ${phaseNames[phase]}`,
          ),
        ),
      );
      lines.push("");
      return lines.join("\n");
    }

    lines.push(
      this.bold(
        this.cyan(`▸▸▸ PHASE ${this.currentPhaseNumber}: ${phaseNames[phase]}`),
      ),
    );
    return lines.join("\n");
  }

  renderPhaseEnd(_phase: Phase, result: PhaseResult): string {
    if (!result.success && result.error) {
      return `    ${this.red("✗")} ${this.red(result.error.message)}`;
    }
    return "";
  }

  renderFeatureProgress(features: FeatureProgress[]): string {
    const lines: string[] = [];
    lines.push("");

    for (const feature of features) {
      if (feature.status !== "complete") continue;

      const icon = this.getFeatureIcon(feature.name);
      const progressBar = this.createProgressBar(100, 40);
      const statsStr = feature.stats
        ? `${feature.stats.filesQueued} files queued, ${feature.stats.depsAdded} dependencies added`
        : "";

      lines.push(`    ${icon} ${this.bold(feature.name)} ${progressBar} 100%`);
      if (statsStr) {
        lines.push(`       ${this.green("✓")} ${statsStr}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private getFeatureIcon(featureName: string): string {
    const iconMap: Record<string, string> = {
      typescript: "🔨",
      eslint: "🧹",
      prettier: "⚙ ",
      vitest: "🧪",
    };
    return iconMap[featureName] ?? "⚙ ";
  }

  private createProgressBar(percent: number, width: number): string {
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    return this.green("━".repeat(filled)) + this.gray("━".repeat(empty));
  }

  renderFileOperation(op: FileOperation): string {
    const symbols: Record<typeof op.operation, string> = {
      generated: this.green("[✓]"),
      created: this.green("[+]"),
      updated: this.cyan("[↻]"),
      deleted: this.red("[-]"),
      skipped: this.gray("[·]"),
    };

    const statusTags: Record<typeof op.status, string> = {
      success: this.dim("success"),
      conflict: this.yellow("conflict"),
      error: this.red("error"),
      "needs-review": this.yellow("needs-review"),
    };

    const symbol = symbols[op.operation];
    const statusTag = statusTags[op.status];
    const dots = ".".repeat(Math.max(0, 50 - op.path.length));

    return `    ${symbol} ${op.path} ${this.dim(dots)} ${statusTag}`;
  }

  renderDependencyOperation(op: DependencyOperation): string {
    const symbols = {
      add: this.green("[+]"),
      remove: this.red("[-]"),
      update: this.cyan("[↻]"),
    };

    const versionStr = op.version ? this.gray(`@${op.version}`) : "";
    return `    ${symbols[op.type]} ${op.packageName}${versionStr}`;
  }

  renderSummary(summary: ApplySummary): string {
    const lines: string[] = [];

    const durationStr = (summary.duration / 1000).toFixed(2);
    lines.push(
      `    ${this.dim("⏱  Completed in")} ${this.bold(`${durationStr}s`)}`,
    );
    lines.push("");

    // File stats
    const fileDetails: string[] = [];
    if (summary.filesCreated > 0)
      fileDetails.push(`${summary.filesCreated} created`);
    if (summary.filesUpdated > 0)
      fileDetails.push(`${summary.filesUpdated} updated`);
    if (summary.filesNeedingReview > 0)
      fileDetails.push(
        this.yellow(`${summary.filesNeedingReview} needs review`),
      );
    if (summary.filesDeleted > 0)
      fileDetails.push(`${summary.filesDeleted} deleted`);

    lines.push(
      `    ${summary.totalFiles} files processed (${fileDetails.join(", ")})`,
    );
    lines.push("");
    lines.push(
      `    ${summary.depsAdded} dependencies added across ${summary.packagesModified} packages`,
    );
    lines.push("");

    // Result status
    if (summary.errors.length === 0) {
      lines.push(`${this.bold(this.green("▸▸▸ RESULT: SUCCESS ✓"))}`);
    } else {
      lines.push(`${this.bold(this.red("▸▸▸ RESULT: FAILED ✗"))}`);
    }

    // Action required
    if (summary.filesNeedingReview > 0 || summary.warnings.length > 0) {
      lines.push("");
      lines.push(`    ${this.yellow("⚠  ACTION REQUIRED:")}`);

      if (summary.filesNeedingReview > 0) {
        lines.push(
          `    ${summary.filesNeedingReview} file${summary.filesNeedingReview > 1 ? "s" : ""} need${summary.filesNeedingReview === 1 ? "s" : ""} manual review`,
        );
      }

      for (const warning of summary.warnings) {
        lines.push(`    ${this.yellow("•")} ${warning}`);
      }
    }

    if (summary.errors.length > 0) {
      lines.push("");
      lines.push(`    ${this.red("ERRORS:")}`);
      for (const error of summary.errors) {
        lines.push(`    ${this.red("•")} ${error}`);
      }
    }

    // Final border
    lines.push("");
    const border =
      "╔═══════════════════════════════════════════════════════════════════╗";
    const message =
      summary.errors.length === 0
        ? "║ 🎉 Configuration successfully applied!                            ║"
        : "║ ⚠️  Configuration applied with errors                             ║";
    const bottomBorder =
      "╚═══════════════════════════════════════════════════════════════════╝";

    lines.push(this.cyan(border));
    lines.push(this.cyan(message));
    lines.push(this.cyan(bottomBorder));

    return lines.join("\n");
  }

  renderInfo(message: string): string {
    return `    ${this.dim("→")} ${message}`;
  }

  renderWarn(message: string): string {
    return `    ${this.yellow("⚠")} ${message}`;
  }

  renderError(message: string, error?: Error): string {
    const errorMsg = error ? `\n    ${this.dim(error.message)}` : "";
    return `    ${this.red("✗")} ${message}${errorMsg}`;
  }

  renderSuccess(message: string): string {
    return `    ${this.green("✓")} ${message}`;
  }
}
