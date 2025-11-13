# condu CLI Output Design Proposal

## Executive Summary

This proposal outlines a modern, informative, and visually appealing CLI output system for condu, with emphasis on the `apply` command. The design supports two rendering modes (interactive and non-interactive) with three output levels (normal, verbose, quiet), and provides a flexible, singleton-based reporter architecture that can be used across all condu commands.

## Design Goals

1. **Informative**: Show users exactly what's happening at each stage
2. **Confidence-inspiring**: Clear progress indicators and summaries
3. **Adaptive**: Automatically adjust output based on environment (TTY, CI, etc.)
4. **Compact**: Efficient use of terminal space, especially for quiet mode
5. **Modern & Clean**: Eye-catching design with emojis and colors
6. **Practical**: Easy to parse in logs, grep-friendly when needed

## Output Modes

### Rendering Modes

**Interactive Mode** (TUI-like)
- **When**: TTY detected AND not in CI
- **Behavior**: Updates terminal state in-place using ANSI escape codes
- **Features**: Spinners, dynamic line updates, live progress
- **Implementation**: Uses `clearLine()`, `cursorTo()`, rewrites lines

**Non-Interactive Mode** (Append-only)
- **When**: CI environment OR non-TTY (stdout or stdin) OR `CI=true`
- **Behavior**: Append-only output, no line rewrites
- **Features**: Clear section markers, grep-friendly, no animations
- **Implementation**: Simple `console.log()` style output

### Verbosity Levels

**Normal Mode** (default)
- Standard output with key information
- Feature progress, file operations, summaries

**Verbose Mode** (`--verbose` or `-v`)
- Detailed output including additional task logs
- Shows what each feature is doing at each step
- Displays arbitrary logs attached to current operations

**Quiet Mode** (`--quiet` or `-q`)
- Minimal output - single line with spinner (interactive) or minimal text (non-interactive)
- Only summary at the end
- Used for postinstall contexts

---

## Output Examples

### Interactive Mode (Normal)

```
→ condu apply

Loading configuration
  ✓ 8 features found

Collecting state
  ✓ typescript
  ✓ eslint
  ⠋ prettier › Modifying package.json...
  · vitest
  · github-actions
  · moon
  · webpack
  · autolink

Applying changes
  Files
    ✓ .config/tsconfig.base.json          [generated]
    ✓ .config/tsconfig.json               [generated]
    ↻ packages/.../tsconfig.json          [updated]
    + packages/.../package.json           [created]
    ⚠ .config/eslintrc.json               [needs-review]

  Dependencies
    + typescript@^5.7.3
    + @typescript-eslint/parser@^8.20.0

Summary
  12 files processed (4 new, 6 updated, 1 review, 1 deleted)
  3 packages modified
  ⚠ 1 file needs manual review

✓ Complete in 2.3s
```

### Interactive Mode (Verbose)

```
→ condu apply

Loading configuration
  ✓ 8 features found

Collecting state
  ✓ typescript
    Generating tsconfig.base.json
    Generating package-specific tsconfig files
    Adding typescript dependency
  ✓ eslint
    Generating .eslintrc.json
    Generating .eslintignore
    Adding eslint dependencies
  ⠋ prettier › Modifying package.json...
    Checking existing prettier config
    Generating .prettierrc.json
  · vitest
  · github-actions
  · moon
  · webpack
  · autolink

[continues with more detail...]
```

### Interactive Mode (Quiet)

```
Applying 8 features
⠋ prettier › Modifying package.json...
✓ 12 files, 3 packages, 1 needs review (2.3s)
```

### Non-Interactive Mode (Normal)

```
condu apply

Loading configuration
  8 features found

Processing features (8)
  ✓ typescript (1/8)
  ✓ eslint (2/8)
  ✓ prettier (3/8)
  ✓ vitest (4/8)
  ✓ github-actions (5/8)
  ✓ moon (6/8)
  ✓ webpack (7/8)
  ✓ autolink (8/8)

Applying changes
  ✓ .config/tsconfig.base.json [generated]
  ✓ .config/tsconfig.json [generated]
  ↻ packages/platform/condu/tsconfig.json [updated]
  + packages/features/new-feature/package.json [created]
  ⚠ .config/eslintrc.json [needs-review]

Adding dependencies
  + typescript@^5.7.3
  + @typescript-eslint/parser@^8.20.0

Summary: 12 files, 3 packages, 1 needs review
✓ Complete in 2.3s

⚠ Manual review required:
  .config/eslintrc.json (line 42: conflicting config)
```

### Non-Interactive Mode (Verbose)

```
condu apply

Loading configuration
  8 features found

Processing features (8)
  ✓ typescript (1/8)
    Generating tsconfig.base.json
    Generating package-specific tsconfig files
    Adding typescript dependency
  ✓ eslint (2/8)
    Generating .eslintrc.json
    Generating .eslintignore
    Adding eslint dependencies
  ✓ prettier (3/8)
    Checking existing prettier config
    Generating .prettierrc.json
[continues...]
```

### Non-Interactive Mode (Quiet)

```
Applying 8 features...
✓ 12 files, 3 packages, 1 needs review (2.3s)
```

---

## Reporting Condu API Operations

The reporter tracks and displays all operations performed through the condu feature API. Here's how each capability is reported:

### File Operations

**generateFile()**
```typescript
reporter.log('Generating .config/tsconfig.json')
reporter.reportFile({
  path: '.config/tsconfig.json',
  operation: 'generated',
  status: 'success',
  managedBy: ['typescript']
})
```

**modifyGeneratedFile()**
```typescript
reporter.log('Modifying .config/eslintrc.json')
reporter.reportFile({
  path: '.config/eslintrc.json',
  operation: 'updated',
  status: 'success',
  managedBy: ['eslint', 'prettier']
})
```

**modifyUserEditableFile()**
```typescript
reporter.log('Modifying user-editable package.json')
reporter.reportFile({
  path: 'package.json',
  operation: 'updated',
  status: 'success',
  managedBy: ['typescript']
})
```

**ignoreFile()**
```typescript
reporter.log('Adding .DS_Store to .gitignore')
// Internally tracked, shown in summary if verbose
```

### Dependency Operations

**ensureDependency()**
```typescript
reporter.log('Adding typescript@^5.7.3 to devDependencies')
reporter.reportDependency({
  type: 'add',
  packageName: 'typescript',
  version: '^5.7.3',
  scope: 'devDependencies',
  target: 'workspace'
})
```

**setDependencyResolutions()**
```typescript
reporter.log('Setting resolution: typescript=5.7.3')
// Shown in applying phase under "Resolutions"
```

### Package Modifications

**modifyPackageJson()**
```typescript
reporter.log('Modifying package.json scripts')
reporter.reportFile({
  path: 'package.json',
  operation: 'updated',
  status: 'success',
  managedBy: ['moon']
})
```

**modifyPublishedPackageJson()**
```typescript
reporter.log('Modifying published package.json exports')
reporter.reportFile({
  path: 'package.json',
  operation: 'updated',
  status: 'success',
  managedBy: ['condu-build']
})
```

### Task Operations

**defineTask()**
```typescript
reporter.log('Defining task: build')
// Shown in summary: "8 tasks defined"
```

### Complete Feature Example (Verbose)

```
→ condu apply --verbose

Loading configuration
  ✓ 8 features found

Collecting state
  ✓ typescript (1/8)
    Initializing typescript
    Generating .config/tsconfig.base.json
    Generating .config/tsconfig.json
    Generating packages/platform/condu/tsconfig.json
    Adding typescript@^5.7.3 to devDependencies
    Adding @typescript-eslint/parser@^8.20.0 to devDependencies
    Modifying package.json scripts
    Defining task: typecheck
    Recipe defined
  ✓ eslint (2/8)
    Initializing eslint
    Generating .config/eslintrc.json
    Generating .config/.eslintignore
    Adding eslint@^9.20.0 to devDependencies
    Adding @typescript-eslint/eslint-plugin@^8.20.0 to devDependencies
    Modifying package.json scripts
    Defining task: lint
    Recipe defined
  ✓ prettier (3/8)
    Initializing prettier
    Checking existing prettier config
    Generating .config/.prettierrc.json
    Modifying .config/eslintrc.json (eslint integration)
    Adding prettier@^3.4.2 to devDependencies
    Adding eslint-config-prettier@^9.1.0 to devDependencies
    Modifying package.json scripts
    Defining task: format
    Recipe defined
  ✓ vitest (4/8)
    Initializing vitest
    Generating vitest.config.ts
    Adding vitest@^3.2.4 to devDependencies
    Modifying package.json scripts
    Defining task: test
    Recipe defined
  [... continues for all features ...]

Applying changes
  Files
    ✓ .config/tsconfig.base.json          [generated by typescript]
    ✓ .config/tsconfig.json               [generated by typescript]
    ✓ .config/eslintrc.json               [generated by eslint, prettier]
    ✓ .config/.eslintignore               [generated by eslint]
    ✓ .config/.prettierrc.json            [generated by prettier]
    ↻ packages/platform/condu/tsconfig.json [updated by typescript]
    ↻ package.json                         [updated by typescript, eslint, prettier, vitest]

  Dependencies (workspace)
    + typescript@^5.7.3                    [devDependencies]
    + @typescript-eslint/parser@^8.20.0    [devDependencies]
    + @typescript-eslint/eslint-plugin@^8.20.0 [devDependencies]
    + eslint@^9.20.0                       [devDependencies]
    + eslint-config-prettier@^9.1.0        [devDependencies]
    + prettier@^3.4.2                      [devDependencies]
    + vitest@^3.2.4                        [devDependencies]

  Tasks
    ✓ typecheck defined in workspace
    ✓ lint defined in workspace
    ✓ format defined in workspace
    ✓ test defined in workspace

Summary
  8 features processed
  15 files processed (7 generated, 8 updated)
  1 package modified
  7 dependencies added
  4 tasks defined

✓ Complete in 2.3s
```

### Normal Mode (Less Verbose)

In normal mode, the detailed logs are hidden, showing only:

```
→ condu apply

Loading configuration
  ✓ 8 features found

Collecting state
  ✓ typescript (1/8)
  ✓ eslint (2/8)
  ✓ prettier (3/8)
  ✓ vitest (4/8)
  ✓ github-actions (5/8)
  ✓ moon (6/8)
  ✓ webpack (7/8)
  ✓ autolink (8/8)

Applying changes
  Files
    ✓ .config/tsconfig.base.json          [generated]
    ✓ .config/tsconfig.json               [generated]
    ✓ .config/eslintrc.json               [generated]
    ↻ package.json                         [updated]

  Dependencies
    + typescript@^5.7.3
    + eslint@^9.20.0
    + prettier@^3.4.2
    + vitest@^3.2.4

Summary
  15 files processed, 1 package modified, 7 deps added, 4 tasks defined

✓ Complete in 2.3s
```

---

## Interactive Prompts & Conflict Resolution

One of the key features of the reporter is the ability to **pause the output**, display arbitrary content (like diffs), handle user input, and **resume** normal operation.

### Example: Manual Conflict Resolution (Interactive)

```
→ condu apply

Loading configuration
  ✓ 8 features found

Collecting state
  ✓ typescript
  ✓ eslint
  ✓ prettier
  [... continues ...]

Applying changes
  Files
    ✓ .config/tsconfig.base.json          [generated]
    ✓ .config/tsconfig.json               [generated]
    ⚠ .config/eslintrc.json               [conflict detected]

┌─────────────────────────────────────────────────────────────────────
│ Manual review required: .config/eslintrc.json
│
│ The file has been modified manually. Choose how to proceed:
│
│ --- Expected (generated by condu)
│ +++ Current (in filesystem)
│ @@ -15,7 +15,7 @@
│    "rules": {
│ -    "no-console": "error",
│ +    "no-console": "warn",
│      "indent": ["error", 2]
│    }
│
│ Options:
│   [k] Keep current version (yours)
│   [o] Overwrite with generated version (condu's)
│   [e] Edit manually
│   [s] Skip (leave as-is, mark as unmanaged)
│   [d] Show full diff
│
│ Your choice: █
└─────────────────────────────────────────────────────────────────────

[User input happens here, then output resumes]

Applying changes (continued)
  Files
    ↻ .config/eslintrc.json               [kept yours]
    ✓ packages/.../package.json           [created]
    [... continues ...]
```

### Non-Interactive Mode (No prompts)

In non-interactive mode, conflicts are **never** prompted interactively. Instead, they're logged and skipped:

```
Applying changes
  ✓ .config/tsconfig.base.json [generated]
  ✓ .config/tsconfig.json [generated]
  ⚠ .config/eslintrc.json [needs-review]

Summary: 12 files, 3 packages, 1 needs review
✓ Complete in 2.3s

⚠ Manual review required:
  .config/eslintrc.json (line 42: conflicting config)

Run in an interactive terminal to resolve conflicts.
```

---

## Color Scheme

### Interactive Mode (with colors)
- **Success**: Green (`\x1b[32m`)
- **Warning**: Yellow (`\x1b[33m`)
- **Error**: Red (`\x1b[31m`)
- **Info**: Cyan (`\x1b[36m`)
- **Muted/Pending**: Gray (`\x1b[90m`)
- **Highlight**: Bright White (`\x1b[97m`)

### Non-Interactive Mode
- Plain text with semantic prefixes: `✓`, `✗`, `⚠`, `→`
- Optional: Use ANSI colors but no animations

### Quiet Mode
- Minimal color usage, mainly success/error indicators

---

## Symbol Reference

| Symbol | Meaning | Usage |
|--------|---------|-------|
| ✓ | Success | Completed operation |
| ✗ | Error | Failed operation |
| ⚠ | Warning | Needs attention |
| ↻ | Updated | File modified |
| + | Added | New file/dependency |
| - | Removed | Deleted file/dependency |
| → | In Progress | Current action |
| · | Pending | Queued operation (dim) |
| ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ | Spinner | Active processing (cycles) |

---

## Implementation Architecture

### Core Components

```typescript
// packages/platform/condu-reporter/index.ts

/**
 * Singleton reporter instance for all condu CLI output
 */
export class ConduReporter {
  private mode: 'interactive' | 'non-interactive'
  private verbosity: 'quiet' | 'normal' | 'verbose'
  private supportsColor: boolean
  private isInteractiveTTY: boolean
  private startTime: number
  private currentPhase?: Phase
  private features: FeatureProgress[] = []
  private files: FileOperation[] = []
  private currentTaskLogs: string[] = []
  private isPaused = false

  // Singleton pattern
  private static instance?: ConduReporter

  static initialize(options?: ReporterOptions): ConduReporter {
    if (!ConduReporter.instance) {
      ConduReporter.instance = new ConduReporter(options)
    }
    return ConduReporter.instance
  }

  static get(): ConduReporter {
    if (!ConduReporter.instance) {
      throw new Error('Reporter not initialized')
    }
    return ConduReporter.instance
  }

  // Phase management
  startPhase(phase: Phase): void
  endPhase(phase: Phase, result: PhaseResult): void

  // Feature reporting
  startFeature(name: string, context: FeatureContext): void
  updateFeature(name: string, message: string): void
  endFeature(name: string, stats: FeatureStats): void

  // Task logging (for verbose mode)
  log(message: string): void  // Adds log to current task
  clearLogs(): void           // Clears accumulated logs

  // File operations
  reportFile(operation: FileOperation): void

  // Dependencies
  reportDependency(operation: DependencyOperation): void

  // Messages
  info(message: string): void
  warn(message: string): void
  error(message: string, error?: Error): void
  success(message: string): void

  // Summary
  printSummary(summary: ApplySummary): void

  // Interactive prompts (only works in interactive mode)
  pause(): void                           // Pause output updates
  resume(): void                          // Resume output updates
  prompt<T>(options: PromptOptions<T>): Promise<T>  // Show interactive prompt
  showDiff(file: string, diff: string): void        // Display diff

  // Low-level control (for advanced use)
  write(text: string): void
  clearLine(): void
  updateLine(text: string): void
}

// Auto-detect mode
function detectMode(): 'interactive' | 'non-interactive' {
  if (process.env.CI === 'true') return 'non-interactive'
  // Interactive requires BOTH stdout (for display) AND stdin (for input)
  if (!process.stdout.isTTY || !process.stdin.isTTY) return 'non-interactive'
  return 'interactive'
}

// Auto-detect color support
function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false
  if (process.env.FORCE_COLOR) return true
  if (!process.stdout.isTTY) return false
  return true
}

// Initialize singleton at module load
export const reporter = ConduReporter.initialize({
  mode: detectMode(),
  verbosity: 'normal',
  supportsColor: supportsColor(),
  isInteractiveTTY: process.stdout.isTTY,
})

// Re-export for convenience
export default reporter
```

### Type Definitions

```typescript
// packages/platform/condu-reporter/types.ts

export type Phase =
  | 'init'
  | 'loading'
  | 'collecting'
  | 'applying'
  | 'complete'

export type ReporterMode = 'interactive' | 'non-interactive'

export type VerbosityLevel = 'quiet' | 'normal' | 'verbose'

export interface ReporterOptions {
  mode?: ReporterMode
  verbosity?: VerbosityLevel
  supportsColor?: boolean
  isInteractiveTTY?: boolean
}

export interface FeatureContext {
  index: number
  total: number
}

export interface FeatureStats {
  filesQueued: number
  depsAdded: number
  resolutionsSet: number
  packagesModified: number
}

export interface FeatureProgress {
  name: string
  status: 'pending' | 'in-progress' | 'complete' | 'error'
  message?: string
  stats?: FeatureStats
  logs: string[]  // Accumulated logs for verbose mode
}

export interface FileOperation {
  path: string
  operation: 'generated' | 'updated' | 'created' | 'deleted' | 'skipped'
  status: 'success' | 'conflict' | 'error'
  managedBy: string[]
}

export interface DependencyOperation {
  type: 'add' | 'remove' | 'update'
  packageName: string
  version?: string
  scope: 'dependencies' | 'devDependencies' | 'peerDependencies'
  target: string // package path
}

export interface PhaseResult {
  success: boolean
  error?: Error
  duration?: number
}

export interface ApplySummary {
  totalFeatures: number
  totalFiles: number
  filesCreated: number
  filesUpdated: number
  filesDeleted: number
  filesSkipped: number
  filesNeedingReview: number
  packagesModified: number
  depsAdded: number
  depsRemoved: number
  duration: number
  errors: string[]
  warnings: string[]
}

export interface PromptOptions<T> {
  message: string
  choices?: Array<{ key: string; label: string; value: T }>
  default?: T
  type?: 'select' | 'confirm' | 'input'
}
```

### Renderer Abstraction

```typescript
// packages/platform/condu-reporter/renderers/BaseRenderer.ts

export abstract class BaseRenderer {
  protected supportsColor: boolean
  protected verbosity: VerbosityLevel

  constructor(supportsColor: boolean, verbosity: VerbosityLevel) {
    this.supportsColor = supportsColor
    this.verbosity = verbosity
  }

  abstract renderPhaseStart(phase: Phase): string
  abstract renderPhaseEnd(phase: Phase, result: PhaseResult): string
  abstract renderFeatureProgress(features: FeatureProgress[]): string
  abstract renderFileOperation(op: FileOperation): string
  abstract renderDependencyOperation(op: DependencyOperation): string
  abstract renderSummary(summary: ApplySummary): string

  // Utility methods
  protected color(text: string, color: AnsiColor): string {
    if (!this.supportsColor) return text
    return `\x1b[${color}m${text}\x1b[0m`
  }

  protected bold(text: string): string {
    if (!this.supportsColor) return text
    return `\x1b[1m${text}\x1b[0m`
  }

  protected dim(text: string): string {
    if (!this.supportsColor) return text
    return `\x1b[2m${text}\x1b[0m`
  }
}

// Separate renderers for each mode
// packages/platform/condu-reporter/renderers/InteractiveRenderer.ts
export class InteractiveRenderer extends BaseRenderer {
  renderFeatureProgress(features: FeatureProgress[]): string {
    const lines = features.map(f => {
      const symbol = this.getStatusSymbol(f.status)
      const message = f.message ? ` › ${f.message}` : ''
      const logs = this.verbosity === 'verbose' && f.logs.length > 0
        ? '\n' + f.logs.map(log => `    ${log}`).join('\n')
        : ''
      return `  ${symbol} ${f.name}${message}${logs}`
    })
    return lines.join('\n')
  }

  private getStatusSymbol(status: FeatureProgress['status']): string {
    switch (status) {
      case 'complete': return this.color('✓', '32')  // green
      case 'in-progress': return '⠋'  // spinner frame
      case 'error': return this.color('✗', '31')  // red
      case 'pending': return this.dim('·')
    }
  }
}

// packages/platform/condu-reporter/renderers/NonInteractiveRenderer.ts
export class NonInteractiveRenderer extends BaseRenderer {
  renderFeatureProgress(features: FeatureProgress[]): string {
    const lines = features
      .filter(f => f.status !== 'pending')
      .map((f, idx) => {
        const symbol = this.getStatusSymbol(f.status)
        const counter = `(${idx + 1}/${features.length})`
        const logs = this.verbosity === 'verbose' && f.logs.length > 0
          ? '\n' + f.logs.map(log => `    ${log}`).join('\n')
          : ''
        return `${symbol} ${f.name} ${counter}${logs}`
      })
    return lines.join('\n')
  }

  private getStatusSymbol(status: FeatureProgress['status']): string {
    switch (status) {
      case 'complete': return '✓'
      case 'in-progress': return '→'
      case 'error': return '✗'
      case 'pending': return '·'
    }
  }
}
```

### Integration with Apply Command

```typescript
// packages/platform/condu/commands/apply/apply.ts

import { reporter } from '@condu/reporter'

export async function apply(): Promise<void> {
  reporter.startPhase('init')

  try {
    // Loading phase
    reporter.startPhase('loading')
    reporter.info('Loading configuration')

    const { conduConfigFileObject } = await loadConduConfigFromFilesystem()
    const { conduProject } = await loadConduProject()

    const features = preprocessFeatures(conduConfigFileObject.features)
    reporter.success(`${features.length} features found`)
    reporter.endPhase('loading', { success: true })

    // Collecting phase
    reporter.startPhase('collecting')
    const state = await collectState({
      conduProject,
      features,
    })
    reporter.endPhase('collecting', { success: true })

    // Applying phase
    reporter.startPhase('applying')
    const result = await applyAndCommitCollectedState({
      state,
      conduProject,
    })
    reporter.endPhase('applying', { success: true })

    // Summary
    reporter.startPhase('complete')
    reporter.printSummary(result.summary)
    reporter.endPhase('complete', { success: true })

  } catch (error) {
    reporter.error('Apply failed', error as Error)
    reporter.endPhase('complete', {
      success: false,
      error: error as Error
    })
    throw error
  }
}
```

### Integration with Feature Execution

```typescript
// packages/platform/condu/commands/apply/collectState.ts

import { reporter } from '@condu/reporter'

export async function collectState(options: CollectStateOptions) {
  const { features } = options

  // Report feature pipeline
  for (const [index, feature] of features.entries()) {
    reporter.startFeature(feature.name, {
      index,
      total: features.length,
    })

    try {
      // Execute recipe
      reporter.log(`Initializing ${feature.name}`)
      await feature.defineRecipe?.(api)
      reporter.log(`Recipe defined`)

      // Report stats
      reporter.endFeature(feature.name, {
        filesQueued: /* count */,
        depsAdded: /* count */,
        resolutionsSet: /* count */,
        packagesModified: /* count */,
      })
    } catch (error) {
      reporter.error(`Feature ${feature.name} failed`, error)
      throw error
    }
  }

  return state
}
```

### Integration with File Operations

```typescript
// packages/platform/condu/commands/apply/FileManager.ts

import { reporter } from '@condu/reporter'

export class FileManager {
  async applyAllFiles(): Promise<void> {
    for (const [relPath, file] of this.files.entries()) {
      try {
        reporter.log(`Processing ${relPath}`)

        const hasManualChanges = await this.detectManualChanges(file)

        if (hasManualChanges && reporter.mode === 'interactive') {
          // Pause output and show interactive prompt
          reporter.pause()

          const diff = await this.generateDiff(file)
          const choice = await reporter.prompt({
            message: `Manual review required: ${relPath}`,
            type: 'select',
            choices: [
              { key: 'k', label: 'Keep current version (yours)', value: 'keep' },
              { key: 'o', label: 'Overwrite with generated version', value: 'overwrite' },
              { key: 'e', label: 'Edit manually', value: 'edit' },
              { key: 's', label: 'Skip', value: 'skip' },
              { key: 'd', label: 'Show full diff', value: 'diff' },
            ],
          })

          await this.handleConflictChoice(file, choice)

          reporter.resume()
        } else {
          await this.applyFile(file)
        }

        reporter.reportFile({
          path: relPath,
          operation: this.mapStatus(file.lastApplyKind),
          status: file.status === 'needs-user-input' ? 'conflict' : 'success',
          managedBy: file.managedByFeatures.map(f => f.featureName),
        })
      } catch (error) {
        reporter.error(`Failed to apply ${relPath}`, error)
        throw error
      }
    }
  }
}
```

---

## Environment Detection

```typescript
// packages/platform/condu-reporter/detection.ts

export function detectEnvironment() {
  return {
    isCI: Boolean(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL
    ),
    isTTY: process.stdout.isTTY ?? false,
    supportsColor: detectColorSupport(),
    terminalWidth: process.stdout.columns ?? 80,
    isQuiet: process.env.CONDU_QUIET === 'true',
  }
}

function detectColorSupport(): boolean {
  // NO_COLOR env var disables colors
  if ('NO_COLOR' in process.env) return false

  // FORCE_COLOR forces colors
  if ('FORCE_COLOR' in process.env) return true

  // Check TTY and color level
  if (!process.stdout.isTTY) return false

  // Windows 10+ supports colors
  if (process.platform === 'win32') return true

  // Check TERM variable
  const term = process.env.TERM ?? ''
  if (term === 'dumb') return false
  if (term.includes('color') || term.includes('256')) return true

  return true
}
```

---

## CLI Flags

Add new flags to the apply command:

```typescript
// packages/platform/condu/commands/ApplyCommand.ts

import { reporter } from '@condu/reporter'

export class ApplyCommand extends Command {
  static paths = [['apply']]

  quiet = Option.Boolean('--quiet,-q', false, {
    description: 'Minimal output, single line summary only',
  })

  verbose = Option.Boolean('--verbose,-v', false, {
    description: 'Show detailed output including debug information',
  })

  noColor = Option.Boolean('--no-color', false, {
    description: 'Disable colored output',
  })

  interactive = Option.Boolean('--interactive,-i', undefined, {
    description: 'Force interactive mode (overrides auto-detection)',
  })

  nonInteractive = Option.Boolean('--non-interactive', false, {
    description: 'Force non-interactive mode (no prompts)',
  })

  async execute() {
    // Determine verbosity
    const verbosity: VerbosityLevel = this.quiet
      ? 'quiet'
      : this.verbose
      ? 'verbose'
      : 'normal'

    // Determine mode
    let mode: ReporterMode
    if (this.nonInteractive) {
      mode = 'non-interactive'
    } else if (this.interactive !== undefined) {
      mode = this.interactive ? 'interactive' : 'non-interactive'
    } else {
      mode = detectMode()  // Auto-detect based on TTY
    }

    // Re-initialize reporter with CLI options
    reporter.initialize({
      mode,
      verbosity,
      supportsColor: !this.noColor && supportsColor(),
      isInteractiveTTY: process.stdout.isTTY,
    })

    await apply()
  }
}
```

---

## Spinner Implementation

For the interactive mode with spinners:

```typescript
// packages/platform/condu-reporter/Spinner.ts

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class Spinner {
  private frame = 0
  private intervalId?: NodeJS.Timeout
  private text = ''
  private isActive = false

  start(text: string) {
    this.text = text
    this.isActive = true

    if (process.stdout.isTTY) {
      this.intervalId = setInterval(() => {
        this.render()
        this.frame = (this.frame + 1) % SPINNER_FRAMES.length
      }, 80)
    } else {
      // Non-TTY: just print once
      process.stdout.write(`${text}...\n`)
    }
  }

  update(text: string) {
    this.text = text
    if (process.stdout.isTTY) {
      this.render()
    }
  }

  stop(finalText?: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    if (process.stdout.isTTY) {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      if (finalText) {
        process.stdout.write(`${finalText}\n`)
      }
    }

    this.isActive = false
  }

  private render() {
    if (!process.stdout.isTTY || !this.isActive) return

    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
    process.stdout.write(`${SPINNER_FRAMES[this.frame]} ${this.text}`)
  }
}
```

---

## Interactive Prompt Implementation

```typescript
// packages/platform/condu-reporter/Prompt.ts

import * as readline from 'node:readline'

export async function prompt<T>(options: PromptOptions<T>): Promise<T> {
  const { message, choices, type = 'select' } = options

  // Display the prompt box
  console.log('┌─────────────────────────────────────────────────────────────────────')
  console.log(`│ ${message}`)
  console.log('│')

  if (type === 'select' && choices) {
    console.log('│ Options:')
    for (const choice of choices) {
      console.log(`│   [${choice.key}] ${choice.label}`)
    }
    console.log('│')
    console.log('│ Your choice: ')
    console.log('└─────────────────────────────────────────────────────────────────────')

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question('', (answer) => {
        rl.close()
        const choice = choices.find(c => c.key === answer.trim())
        if (choice) {
          resolve(choice.value)
        } else {
          console.log(`Invalid choice: ${answer}`)
          resolve(prompt(options))  // Retry
        }
      })
    })
  }

  throw new Error('Unsupported prompt type')
}
```

---

## Progressive Enhancement Strategy

### Phase 1: Core Infrastructure (v1)
1. Implement `ConduReporter` class with singleton pattern
2. Add basic renderers for interactive and non-interactive modes
3. Integrate into `apply` command at key points
4. Add environment detection
5. Support normal, verbose, quiet verbosity levels

### Phase 2: Interactive Features (v1.1)
1. Implement pause/resume functionality
2. Add interactive prompts for conflict resolution
3. Implement diff display
4. Add spinner animations for interactive mode

### Phase 3: Enhancements (v2)
1. Add progress percentage calculation
2. Add estimated time remaining
3. Support for nested operations (e.g., sub-tasks within features)
4. Performance profiling (which features take longest)

---

## Testing Strategy

```typescript
// packages/platform/condu-reporter/ConduReporter.test.ts

describe('ConduReporter', () => {
  it('auto-detects non-interactive mode from CI environment', () => {
    process.env.CI = 'true'
    const reporter = ConduReporter.initialize()
    expect(reporter.mode).toBe('non-interactive')
  })

  it('respects NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1'
    const reporter = ConduReporter.initialize()
    expect(reporter.supportsColor).toBe(false)
  })

  it('outputs correct format in quiet mode', () => {
    const output = captureStdout(() => {
      const reporter = ConduReporter.initialize({
        mode: 'non-interactive',
        verbosity: 'quiet',
      })
      reporter.startPhase('applying')
      reporter.printSummary(mockSummary)
    })

    expect(output).toMatch(/✓ \d+ files processed/)
  })

  it('accumulates logs in verbose mode', () => {
    const reporter = ConduReporter.initialize({ verbosity: 'verbose' })
    reporter.startFeature('typescript', { index: 0, total: 1 })
    reporter.log('Generating tsconfig')
    reporter.log('Adding dependencies')

    expect(reporter.features[0].logs).toHaveLength(2)
  })

  it('does not show prompts in non-interactive mode', async () => {
    const reporter = ConduReporter.initialize({ mode: 'non-interactive' })

    const result = await reporter.prompt({
      message: 'Choose',
      choices: [{ key: 'y', label: 'Yes', value: true }],
    })

    // Should throw or return default without prompting
    expect(result).toBeUndefined()
  })
})
```

---

## Recommendation

**For initial implementation:**

1. **Start with non-interactive mode**
   - Simplest, most stable
   - Works everywhere (CI, TTY, non-TTY)
   - Easy to test

2. **Add interactive mode next**
   - Implement spinners for live updates
   - Add color support with fallbacks
   - Implement pause/resume for prompts

3. **Use singleton pattern** for reporter
   - Export initialized instance: `import { reporter } from '@condu/reporter'`
   - No need to pass through function parameters
   - Easy to use anywhere in codebase

4. **Progressive enhancement**
   - Start with basic text output in non-interactive mode
   - Add interactive mode with spinners
   - Then add color support
   - Finally add interactive prompts for conflict resolution

5. **Environment variables and flags**
   - `CONDU_QUIET=true` OR `--quiet` → quiet verbosity
   - `--verbose` OR `-v` → verbose verbosity
   - `NO_COLOR=1` OR `--no-color` → disable colors
   - `--interactive` → force interactive mode
   - `--non-interactive` → force non-interactive mode
   - Auto-detect: Interactive mode requires both `stdin.isTTY` AND `stdout.isTTY` (for input and display)
   - Auto-detect: `CI=true` forces non-interactive mode

This approach provides immediate value while allowing for iterative improvement.

---

## Package Structure

The reporter should be its own package for modularity:

```
packages/
  platform/
    condu-reporter/
      package.json          # name: "@condu/reporter"
      index.ts              # Re-exports everything
      ConduReporter.ts      # Main class
      types.ts              # Type definitions
      detection.ts          # Environment detection
      Spinner.ts            # Spinner implementation
      Prompt.ts             # Interactive prompts
      renderers/
        BaseRenderer.ts
        InteractiveRenderer.ts
        NonInteractiveRenderer.ts
```

**package.json:**
```json
{
  "name": "@condu/reporter",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./index.ts"
  }
}
```

This allows other condu commands to use the reporter independently:

```typescript
import { reporter } from '@condu/reporter'

reporter.info('Starting build...')
reporter.success('Build complete!')
```

---

## Dependencies

**Recommended approach**: Start with zero dependencies
- No external dependencies, use native Node.js capabilities
- ANSI escape codes directly
- Simple state management
- Use `node:readline` for prompts

**Optional enhancements** (only if needed):
- `picocolors` - tiny color library (2KB)
- `string-width` - proper width calculation for Unicode

**Recommendation**: Start with zero dependencies, add `picocolors` only if color logic gets complex.
