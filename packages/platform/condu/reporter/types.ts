export type Phase = "init" | "loading" | "collecting" | "applying" | "complete";

export type ReporterMode = "local" | "ci" | "quiet";

export type ReporterTheme = "modern" | "retro" | "minimal";

export interface ReporterOptions {
  mode?: ReporterMode;
  theme?: ReporterTheme;
  supportsColor?: boolean;
  isInteractiveTTY?: boolean;
}

export interface FeatureContext {
  index: number;
  total: number;
}

export interface FeatureStats {
  filesQueued: number;
  depsAdded: number;
  resolutionsSet: number;
  packagesModified: number;
}

export interface FeatureProgress {
  name: string;
  status: "pending" | "in-progress" | "complete" | "error";
  index: number;
  total: number;
  message?: string;
  stats?: FeatureStats;
}

export type FileOperationType =
  | "generated"
  | "updated"
  | "created"
  | "deleted"
  | "skipped";

export type FileStatus = "success" | "conflict" | "error" | "needs-review";

export interface FileOperation {
  path: string;
  operation: FileOperationType;
  status: FileStatus;
  managedBy: string[];
}

export interface DependencyOperation {
  type: "add" | "remove" | "update";
  packageName: string;
  version?: string;
  scope: "dependencies" | "devDependencies" | "peerDependencies";
  target: string; // package path
}

export interface PhaseResult {
  success: boolean;
  error?: Error;
  duration?: number;
}

export interface ApplySummary {
  totalFeatures: number;
  totalFiles: number;
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  filesSkipped: number;
  filesNeedingReview: number;
  packagesModified: number;
  depsAdded: number;
  depsRemoved: number;
  duration: number;
  errors: string[];
  warnings: string[];
}

export type AnsiColor =
  | 30 // black
  | 31 // red
  | 32 // green
  | 33 // yellow
  | 34 // blue
  | 35 // magenta
  | 36 // cyan
  | 37 // white
  | 90 // bright black (gray)
  | 91 // bright red
  | 92 // bright green
  | 93 // bright yellow
  | 94 // bright blue
  | 95 // bright magenta
  | 96 // bright cyan
  | 97; // bright white
