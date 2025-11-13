import type {
  AnsiColor,
  ApplySummary,
  DependencyOperation,
  FeatureProgress,
  FileOperation,
  Phase,
  PhaseResult,
} from "../types.js";

export abstract class BaseRenderer {
  protected supportsColor: boolean;

  constructor(supportsColor: boolean) {
    this.supportsColor = supportsColor;
  }

  abstract renderPhaseStart(phase: Phase): string;
  abstract renderPhaseEnd(phase: Phase, result: PhaseResult): string;
  abstract renderFeatureProgress(features: FeatureProgress[]): string;
  abstract renderFileOperation(op: FileOperation): string;
  abstract renderDependencyOperation(op: DependencyOperation): string;
  abstract renderSummary(summary: ApplySummary): string;
  abstract renderInfo(message: string): string;
  abstract renderWarn(message: string): string;
  abstract renderError(message: string, error?: Error): string;
  abstract renderSuccess(message: string): string;

  // Utility methods
  protected color(text: string, color: AnsiColor): string {
    if (!this.supportsColor) return text;
    return `\u001B[${color}m${text}\u001B[0m`;
  }

  protected bold(text: string): string {
    if (!this.supportsColor) return text;
    return `\u001B[1m${text}\u001B[0m`;
  }

  protected dim(text: string): string {
    if (!this.supportsColor) return text;
    return `\u001B[2m${text}\u001B[0m`;
  }

  protected green(text: string): string {
    return this.color(text, 32);
  }

  protected yellow(text: string): string {
    return this.color(text, 33);
  }

  protected red(text: string): string {
    return this.color(text, 31);
  }

  protected cyan(text: string): string {
    return this.color(text, 36);
  }

  protected gray(text: string): string {
    return this.color(text, 90);
  }

  protected brightWhite(text: string): string {
    return this.color(text, 97);
  }
}
