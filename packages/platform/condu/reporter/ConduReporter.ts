import type {
  ApplySummary,
  DependencyOperation,
  FeatureContext,
  FeatureProgress,
  FeatureStats,
  FileOperation,
  Phase,
  PhaseResult,
  ReporterMode,
  ReporterOptions,
  VerbosityLevel,
} from "./types.js";
import { detectColorSupport, detectMode } from "./detection.js";
import { Spinner } from "./Spinner.js";
import type { BaseRenderer } from "./renderers/BaseRenderer.js";
import { CiRenderer } from "./renderers/CiRenderer.js";
import { LocalMinimalRenderer } from "./renderers/LocalMinimalRenderer.js";
import { QuietRenderer } from "./renderers/QuietRenderer.js";

/**
 * Singleton reporter instance for all condu CLI output
 */
export class ConduReporter {
  private mode: ReporterMode;
  private supportsColor: boolean;
  private isInteractiveTTY: boolean;
  private startTime: number;
  private verbosity: VerbosityLevel;
  private currentPhase?: Phase;
  private features: FeatureProgress[] = [];
  private files: FileOperation[] = [];
  private dependencies: DependencyOperation[] = [];
  private renderer: BaseRenderer;
  private spinner?: Spinner;
  private quietRenderer?: QuietRenderer;
  private quietSpinnerText = "Applying configuration";
  private quietSpinnerPaused = false;
  private lastFileFeature?: string;

  // Singleton pattern
  private static instance?: ConduReporter;

  private constructor(options: ReporterOptions) {
    this.mode = options.mode ?? detectMode();
    this.supportsColor = options.supportsColor ?? detectColorSupport();
    this.isInteractiveTTY = options.isInteractiveTTY ?? false;
    this.verbosity =
      this.mode === "quiet"
        ? "quiet"
        : options.verbosity ?? "normal";
    this.startTime = Date.now();

    // Create the appropriate renderer
    this.renderer = this.createRenderer();

    // Create spinner for quiet mode if in TTY
    if (this.mode === "quiet" && this.isInteractiveTTY) {
      this.spinner = new Spinner();
      if (this.renderer instanceof QuietRenderer) {
        this.quietRenderer = this.renderer;
      }
    }
  }

  private createRenderer(): BaseRenderer {
    if (this.mode === "quiet") {
      return new QuietRenderer(this.supportsColor, "quiet");
    }

    if (this.mode === "ci") {
      return new CiRenderer(this.supportsColor, this.verbosity);
    }

    // Local mode
    return new LocalMinimalRenderer(this.supportsColor, this.verbosity);
  }

  static initialize(options: ReporterOptions = {}): ConduReporter {
    if (!ConduReporter.instance) {
      ConduReporter.instance = new ConduReporter(options);
    }
    return ConduReporter.instance;
  }

  static get(): ConduReporter {
    if (!ConduReporter.instance) {
      throw new Error("Reporter not initialized");
    }
    return ConduReporter.instance;
  }

  static reset(): void {
    ConduReporter.instance = undefined;
  }

  // Phase management
  startPhase(phase: Phase): void {
    this.currentPhase = phase;
    if (phase === "applying") {
      this.lastFileFeature = undefined;
    }
    const output = this.renderer.renderPhaseStart(phase);
    if (output) {
      this.write(output);
    }

    // Start spinner for quiet mode
    if (this.mode === "quiet" && this.spinner && phase === "loading") {
      this.quietSpinnerText = "Applying configuration";
      this.spinner.start(this.quietSpinnerText);
      this.quietSpinnerPaused = false;
    }
  }

  endPhase(phase: Phase, result: PhaseResult): void {
    const output = this.renderer.renderPhaseEnd(phase, result);
    if (output) {
      this.write(output);
    }

    // Update spinner or stop it
    if (this.mode === "quiet" && this.spinner) {
      if (phase === "complete") {
        // Don't stop spinner yet, we'll do it in printSummary
      }
    }
  }

  // Feature reporting
  startFeature(name: string, context: FeatureContext): void {
    const existing = this.features.find((f) => f.name === name);
    if (existing) {
      existing.status = "in-progress";
      existing.index = context.index;
      existing.total = context.total;
      existing.logs ??= [];
      this.updateFeatureDisplay(existing);
    } else {
      const feature: FeatureProgress = {
        name,
        status: "in-progress",
        index: context.index,
        total: context.total,
        logs: [],
      };
      this.features.push(feature);
      this.updateFeatureDisplay(feature);
    }
  }

  updateFeature(name: string, message: string): void {
    const feature = this.features.find((f) => f.name === name);
    if (feature) {
      feature.message = message;
      this.updateFeatureDisplay(feature);
    }
  }

  endFeature(name: string, stats: FeatureStats): void {
    const feature = this.features.find((f) => f.name === name);
    if (feature) {
      feature.status = "complete";
      feature.stats = stats;
      feature.logs ??= [];
      this.updateFeatureDisplay(feature);
    }
  }

  private updateFeatureDisplay(feature?: FeatureProgress): void {
    // Update spinner in quiet mode
    if (this.mode === "quiet" && this.spinner && this.quietRenderer) {
      const inProgress = this.features.find((f) => f.status === "in-progress");
      if (inProgress) {
        const message = inProgress.message ? ` › ${inProgress.message}` : "";
        this.quietSpinnerText = `Applying ${this.features.length} features: ${inProgress.name}${message}`;
        this.spinner.update(this.quietSpinnerText);
      }
    } else if (this.mode === "local") {
      // For local mode, we could update the display
      // For now, we'll just render it once after collecting is done
    } else if (this.mode === "ci") {
      if (this.verbosity !== "verbose") {
        return;
      }
      // Render feature progress for CI
      const output = feature
        ? this.renderer.renderFeatureProgress([feature])
        : this.renderer.renderFeatureProgress(this.features);
      if (output) {
        this.write(output);
      }
    }
  }

  // File operations
  reportFile(operation: FileOperation): void {
    this.files.push(operation);

    // Only output in non-quiet mode
    if (this.mode !== "quiet") {
      const output = this.renderer.renderFileOperation(operation);
      if (output) {
        if (this.mode === "ci" || this.mode === "local") {
          const featureName = operation.managedBy[0] ?? "unmanaged";
          const featureSuffix =
            operation.managedBy.length > 1
              ? ` +${operation.managedBy.length - 1} more`
              : "";
          const featureLine = `${featureName}${featureSuffix}`;
          if (featureLine !== this.lastFileFeature) {
            this.lastFileFeature = featureLine;
            this.write(`  ${featureLine}:`);
          }
        }
        this.write(output);
      }
    }
  }

  // Dependencies
  reportDependency(operation: DependencyOperation): void {
    this.dependencies.push(operation);

    // Only output in non-quiet mode
    if (this.mode !== "quiet") {
      const output = this.renderer.renderDependencyOperation(operation);
      if (output) {
        this.write(output);
      }
    }
  }

  // Messages
  info(message: string): void {
    const output = this.renderer.renderInfo(message);
    if (output) {
      this.write(output);
    }
  }

  warn(message: string): void {
    const output = this.renderer.renderWarn(message);
    if (output) {
      this.write(output);
    }
  }

  error(message: string, error?: Error): void {
    // Stop spinner if active
    if (this.spinner) {
      this.spinner.stop();
    }

    const output = this.renderer.renderError(message, error);
    if (output) {
      this.write(output);
    }
  }

  success(message: string): void {
    const output = this.renderer.renderSuccess(message);
    if (output) {
      this.write(output);
    }
  }

  // Summary
  printSummary(summary: ApplySummary): void {
    // Stop spinner if active
    if (this.spinner) {
      this.spinner.stop();
    }

    const output = this.renderer.renderSummary(summary);
    if (output) {
      this.write(output);
    }
  }

  // Low-level control
  write(text: string): void {
    if (text) {
      process.stdout.write(`${text}\n`);
    }
  }

  clearLine(): void {
    if (this.isInteractiveTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  updateLine(text: string): void {
    if (this.isInteractiveTTY) {
      this.clearLine();
      process.stdout.write(text);
    } else {
      this.write(text);
    }
  }

  // Helpers for feature progress display
  renderFeatureList(): void {
    if (this.mode === "local" && this.features.length > 0) {
      const output = this.renderer.renderFeatureProgress(this.features);
      if (output) {
        this.write(output);
      }
    }
  }

  log(message: string, { feature }: { feature?: string } = {}): void {
    if (this.verbosity !== "verbose") {
      return;
    }

    const targetFeature = feature
      ? this.features.find((f) => f.name === feature)
      : undefined;

    if (targetFeature) {
      targetFeature.logs ??= [];
      targetFeature.logs.push(message);
    }

    if (this.mode !== "quiet") {
      const prefix = feature ? `${feature} › ` : "";
      this.write(`  ${prefix}${message}`);
    }
  }

  pauseForUserInput(): void {
    if (this.mode === "quiet" && this.spinner && !this.quietSpinnerPaused) {
      this.spinner.stop();
      this.quietSpinnerPaused = true;
    }
  }

  resumeAfterUserInput(): void {
    if (
      this.mode === "quiet" &&
      this.spinner &&
      this.quietRenderer &&
      this.quietSpinnerPaused
    ) {
      const fallback =
        this.quietRenderer?.getCurrentLine() ?? this.quietSpinnerText;
      this.quietSpinnerText = fallback || "Applying configuration";
      this.spinner.start(this.quietSpinnerText);
      this.quietSpinnerPaused = false;
    }
  }

  // Get elapsed time
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  getMode(): ReporterMode {
    return this.mode;
  }

  getVerbosity(): VerbosityLevel {
    return this.verbosity;
  }
}

// Initialize singleton at module load with auto-detected settings
export const reporter = ConduReporter.initialize({
  mode: detectMode(),
  verbosity: process.env["CONDU_VERBOSE"] === "1" ? "verbose" : "normal",
  supportsColor: detectColorSupport(),
  isInteractiveTTY: process.stdout.isTTY ?? false,
});

// Re-export for convenience
export default reporter;
