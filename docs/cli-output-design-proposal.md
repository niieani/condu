# condu CLI Output Design Proposal

## Executive Summary

This proposal outlines a modern, informative, and visually appealing CLI output system for condu, with emphasis on the `apply` command. The design supports three display modes (local, CI, quiet) and provides a flexible, singleton-based reporter architecture that can be used across all condu commands.

## Design Goals

1. **Informative**: Show users exactly what's happening at each stage
2. **Confidence-inspiring**: Clear progress indicators and summaries
3. **Adaptive**: Automatically adjust output based on environment (TTY, CI, etc.)
4. **Compact**: Efficient use of terminal space, especially for quiet mode
5. **Modern & Stylish**: Eye-catching design with emojis and colors
6. **Practical**: Easy to parse in logs, grep-friendly when needed

## Display Modes

### 1. Local Mode (Full & Fancy)
**When**: Interactive TTY, not in CI, no `--quiet` flag
**Features**: Full color, emojis, spinners, progress bars, detailed output

### 2. CI Mode (Simple & Structured)
**When**: CI environment detected OR `CI=true` OR non-TTY
**Features**: No spinners, plain text, clear section markers, timestamps

### 3. Quiet Mode (Minimal)
**When**: `--quiet` flag OR `CONDU_QUIET=true` OR postinstall context
**Features**: Single line with spinner in TTY, minimal output, summary only

---

## Theme Options

### Option A: Modern Minimalist

**Local Mode Example:**
```
┌─ condu apply
│
├─ Loading configuration...
│  ✓ Found 8 features to apply
│
├─ Collecting state
│  ⠋ typescript › Generating tsconfig files...
│
│  Feature Pipeline:
│  ✓ typescript      (12 files, 3 deps)
│  ✓ eslint          (2 files, 5 deps)
│  ⠋ prettier        Modifying package.json...
│  ○ vitest
│  ○ github-actions
│  ○ moon
│  ○ webpack
│  ○ autolink
│
├─ Applying changes
│  ✓ .config/tsconfig.base.json                    [generated]
│  ✓ .config/tsconfig.json                         [generated]
│  ↻ packages/platform/condu/tsconfig.json         [updated]
│  + packages/features/new-feature/package.json    [created]
│  ⚠ .config/eslintrc.json                         [needs review]
│
│  Dependencies:
│  + typescript@^5.7.3
│  + @typescript-eslint/parser@^8.20.0
│
│  3 packages modified, 12 files processed
│
└─ ✓ Complete in 2.3s

   📝 1 file requires manual review:
      .config/eslintrc.json (line 42: conflicting config)
```

**CI Mode Example:**
```
[condu:apply] Loading configuration...
[condu:apply] Found 8 features to apply

[condu:apply:features] Collecting state...
[condu:apply:features] typescript (1/8)
[condu:apply:features] eslint (2/8)
[condu:apply:features] prettier (3/8)
[condu:apply:features] vitest (4/8)
[condu:apply:features] github-actions (5/8)
[condu:apply:features] moon (6/8)
[condu:apply:features] webpack (7/8)
[condu:apply:features] autolink (8/8)

[condu:apply:files] Applying changes...
[condu:apply:files] ✓ .config/tsconfig.base.json [generated]
[condu:apply:files] ✓ .config/tsconfig.json [generated]
[condu:apply:files] ↻ packages/platform/condu/tsconfig.json [updated]
[condu:apply:files] + packages/features/new-feature/package.json [created]
[condu:apply:files] ⚠ .config/eslintrc.json [needs-review]

[condu:apply:deps] Adding dependencies...
[condu:apply:deps] + typescript@^5.7.3
[condu:apply:deps] + @typescript-eslint/parser@^8.20.0

[condu:apply] Summary: 3 packages modified, 12 files processed
[condu:apply] ⚠ 1 file requires manual review
[condu:apply] ✓ Complete in 2.3s
```

**Quiet Mode Example (TTY):**
```
Applying configuration (8 features)
⠋ eslint › Modifying .config/eslintrc.json...
✓ 12 files processed, 3 packages modified, 1 needs review (2.3s)
```

**Quiet Mode Example (Non-TTY):**
```
Applying configuration (8 features)...
✓ 12 files processed, 3 packages modified, 1 needs review (2.3s)
```

---

### Option B: Retro Terminal

**Local Mode Example:**
```
╔═══════════════════════════════════════════════════════════════════╗
║ 🖥  CONDU APPLY v1.0.3                                            ║
╚═══════════════════════════════════════════════════════════════════╝

▸▸▸ PHASE 1: INITIALIZATION
    → Loading configuration...
    ✓ 8 features ready to process

▸▸▸ PHASE 2: COLLECTING STATE

    🔨 typescript ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%
       ✓ 12 files queued, 3 dependencies added

    🧹 eslint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%
       ✓ 2 files queued, 5 dependencies added

    ⚙  prettier ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%
       ✓ 1 file queued, 2 dependencies added

    [...5 more features...]

▸▸▸ PHASE 3: APPLYING CHANGES

    FILES:
    [✓] .config/tsconfig.base.json ........................ generated
    [✓] .config/tsconfig.json ............................. generated
    [↻] packages/platform/condu/tsconfig.json ............. updated
    [+] packages/features/new-feature/package.json ........ created
    [⚠] .config/eslintrc.json ............................. needs-review

    12 files processed (4 created, 6 updated, 1 needs review, 1 deleted)

    DEPENDENCIES:
    [+] typescript@^5.7.3
    [+] @typescript-eslint/parser@^8.20.0
    [...8 more...]

    10 dependencies added across 3 packages

▸▸▸ RESULT: SUCCESS ✓

    ⏱  Completed in 2.34s

    ⚠  ACTION REQUIRED:
    1 file needs manual review:
    • .config/eslintrc.json (line 42: conflicting config)
      Run: condu review .config/eslintrc.json

╔═══════════════════════════════════════════════════════════════════╗
║ 🎉 Configuration successfully applied!                            ║
╚═══════════════════════════════════════════════════════════════════╝
```

**CI Mode Example:**
```
================================================================================
 CONDU APPLY v1.0.3
================================================================================

>>> PHASE 1: INITIALIZATION
[2025-11-09 10:23:45] Loading configuration...
[2025-11-09 10:23:45] ✓ 8 features ready to process

>>> PHASE 2: COLLECTING STATE
[2025-11-09 10:23:45] [1/8] typescript
[2025-11-09 10:23:46] [2/8] eslint
[2025-11-09 10:23:46] [3/8] prettier
[2025-11-09 10:23:46] [4/8] vitest
[2025-11-09 10:23:46] [5/8] github-actions
[2025-11-09 10:23:46] [6/8] moon
[2025-11-09 10:23:47] [7/8] webpack
[2025-11-09 10:23:47] [8/8] autolink

>>> PHASE 3: APPLYING CHANGES
[2025-11-09 10:23:47] FILES:
[2025-11-09 10:23:47] ✓ generated: .config/tsconfig.base.json
[2025-11-09 10:23:47] ✓ generated: .config/tsconfig.json
[2025-11-09 10:23:47] ↻ updated: packages/platform/condu/tsconfig.json
[2025-11-09 10:23:47] + created: packages/features/new-feature/package.json
[2025-11-09 10:23:47] ⚠ needs-review: .config/eslintrc.json

[2025-11-09 10:23:47] DEPENDENCIES:
[2025-11-09 10:23:47] + typescript@^5.7.3
[2025-11-09 10:23:47] + @typescript-eslint/parser@^8.20.0

>>> RESULT: SUCCESS ✓
[2025-11-09 10:23:47] 12 files processed, 3 packages modified
[2025-11-09 10:23:47] ⚠ 1 file requires manual review
[2025-11-09 10:23:47] Completed in 2.3s

⚠ ACTION REQUIRED:
  .config/eslintrc.json (line 42: conflicting config)

================================================================================
```

**Quiet Mode Example:**
```
▸▸▸ Applying configuration (8 features)
⠙ prettier › Modifying package.json...
✓ Complete: 12 files, 3 packages, 1 needs review (2.3s)
```

---

### Option C: Ultra Minimal (Recommended for CI as default)

**Local Mode Example:**
```
→ condu apply

Loading configuration
  8 features found

Collecting state
  typescript   ✓
  eslint       ✓
  prettier     ⠋ processing...
  vitest       ·
  github-actions  ·
  moon         ·
  webpack      ·
  autolink     ·

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

**CI Mode Example:**
```
condu apply

Loading configuration
  8 features found

Processing features (8)
  typescript (1/8) ✓
  eslint (2/8) ✓
  prettier (3/8) ✓
  vitest (4/8) ✓
  github-actions (5/8) ✓
  moon (6/8) ✓
  webpack (7/8) ✓
  autolink (8/8) ✓

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

**Quiet Mode Example:**
```
Applying 8 features
⠋ prettier › Modifying package.json...
✓ 12 files, 3 packages, 1 needs review (2.3s)
```

---

## Color Scheme

### Local Mode (with colors)
- **Success**: Green (`\x1b[32m`)
- **Warning**: Yellow (`\x1b[33m`)
- **Error**: Red (`\x1b[31m`)
- **Info**: Cyan (`\x1b[36m`)
- **Muted**: Gray (`\x1b[90m`)
- **Highlight**: Bright White (`\x1b[97m`)

### CI Mode (no colors or minimal)
- Plain text with semantic prefixes: `✓`, `✗`, `⚠`, `→`
- Optional: Use ANSI colors but no animations

### Quiet Mode
- Same as CI mode but ultra-condensed

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
| ○ | Pending | Queued operation |
| ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ | Spinner | Active processing (cycles) |
| ┌├└│ | Tree | Structural hierarchy |
| ▸▸▸ | Section | Major phase separator |
| 📝 | Note | Important information |
| 🎉 | Success | Final success message |

---

## Implementation Architecture

### Core Components

```typescript
// packages/platform/condu/reporter/ConduReporter.ts

/**
 * Singleton reporter instance for all condu CLI output
 */
export class ConduReporter {
  private mode: 'local' | 'ci' | 'quiet'
  private theme: 'modern' | 'retro' | 'minimal'
  private supportsColor: boolean
  private isInteractiveTTY: boolean
  private startTime: number
  private currentPhase?: Phase
  private features: FeatureProgress[] = []
  private files: FileOperation[] = []

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

  // File operations
  reportFile(operation: FileOperation): void
  reportConflict(file: string, diff: string): void

  // Dependencies
  reportDependency(operation: DependencyOperation): void

  // Messages
  info(message: string): void
  warn(message: string): void
  error(message: string, error?: Error): void
  success(message: string): void

  // Summary
  printSummary(summary: ApplySummary): void

  // Low-level control (for advanced use)
  write(text: string): void
  clearLine(): void
  updateLine(text: string): void
}

// Auto-detect mode
function detectMode(): 'local' | 'ci' | 'quiet' {
  if (process.env.CONDU_QUIET === 'true') return 'quiet'
  if (process.env.CI === 'true') return 'ci'
  if (!process.stdout.isTTY) return 'ci'
  return 'local'
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
  theme: process.env.CONDU_THEME as any ?? 'minimal',
  supportsColor: supportsColor(),
  isInteractiveTTY: process.stdout.isTTY,
})

// Re-export for convenience
export default reporter
```

### Type Definitions

```typescript
// packages/platform/condu/reporter/types.ts

export type Phase =
  | 'init'
  | 'loading'
  | 'collecting'
  | 'applying'
  | 'complete'

export type ReporterMode = 'local' | 'ci' | 'quiet'

export type ReporterTheme = 'modern' | 'retro' | 'minimal'

export interface ReporterOptions {
  mode?: ReporterMode
  theme?: ReporterTheme
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
```

### Renderer Abstraction

```typescript
// packages/platform/condu/reporter/renderers/BaseRenderer.ts

export abstract class BaseRenderer {
  protected supportsColor: boolean

  constructor(supportsColor: boolean) {
    this.supportsColor = supportsColor
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

// Separate renderers for each mode/theme
// packages/platform/condu/reporter/renderers/LocalModernRenderer.ts
export class LocalModernRenderer extends BaseRenderer { ... }

// packages/platform/condu/reporter/renderers/LocalRetroRenderer.ts
export class LocalRetroRenderer extends BaseRenderer { ... }

// packages/platform/condu/reporter/renderers/LocalMinimalRenderer.ts
export class LocalMinimalRenderer extends BaseRenderer { ... }

// packages/platform/condu/reporter/renderers/CIRenderer.ts
export class CIRenderer extends BaseRenderer { ... }

// packages/platform/condu/reporter/renderers/QuietRenderer.ts
export class QuietRenderer extends BaseRenderer { ... }
```

### Integration with Apply Command

```typescript
// packages/platform/condu/commands/apply/apply.ts

import reporter from '../../reporter/ConduReporter.js'

export async function apply(): Promise<void> {
  reporter.startPhase('init')

  try {
    // Loading phase
    reporter.startPhase('loading')
    reporter.info('Loading configuration...')

    const { conduConfigFileObject } = await loadConduConfigFromFilesystem()
    const { conduProject } = await loadConduProject()

    const features = preprocessFeatures(conduConfigFileObject.features)
    reporter.success(`Found ${features.length} features to apply`)
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

import reporter from '../../reporter/ConduReporter.js'

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
      await feature.defineRecipe?.(api)

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

import reporter from '../../reporter/ConduReporter.js'

export class FileManager {
  async applyAllFiles(): Promise<void> {
    for (const [relPath, file] of this.files.entries()) {
      try {
        await this.applyFile(file)

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
// packages/platform/condu/reporter/detection.ts

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
    preferredTheme: process.env.CONDU_THEME as ReporterTheme | undefined,
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

export class ApplyCommand extends Command {
  static paths = [['apply']]

  quiet = Option.Boolean('--quiet,-q', false, {
    description: 'Minimal output, single line summary only',
  })

  verbose = Option.Boolean('--verbose,-v', false, {
    description: 'Show detailed output including debug information',
  })

  theme = Option.String('--theme', {
    description: 'Output theme: modern, retro, minimal',
  })

  noColor = Option.Boolean('--no-color', false, {
    description: 'Disable colored output',
  })

  async execute() {
    // Initialize reporter with CLI options
    const reporter = ConduReporter.initialize({
      mode: this.quiet ? 'quiet' : detectMode(),
      theme: this.theme as ReporterTheme ?? 'minimal',
      supportsColor: !this.noColor && supportsColor(),
      isInteractiveTTY: process.stdout.isTTY,
    })

    await apply()
  }
}
```

---

## Spinner Implementation

For the quiet/local modes with spinners:

```typescript
// packages/platform/condu/reporter/Spinner.ts

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

## Progressive Enhancement Strategy

### Phase 1: Core Infrastructure
1. Implement `ConduReporter` class with singleton pattern
2. Add basic renderers (CI mode first as baseline)
3. Integrate into `apply` command at key points
4. Add environment detection

### Phase 2: Enhanced Local Mode
1. Implement spinners and progress indicators
2. Add color support with fallbacks
3. Create theme variants (modern, retro, minimal)
4. Add real-time feature progress display

### Phase 3: Quiet Mode
1. Implement compact single-line output
2. Add postinstall context detection
3. Optimize for minimal distraction

### Phase 4: Advanced Features
1. Add `--json` flag for machine-readable output
2. Implement progress percentage calculation
3. Add estimated time remaining
4. Support for nested operations (e.g., sub-tasks within features)

---

## Testing Strategy

```typescript
// packages/platform/condu/reporter/ConduReporter.test.ts

describe('ConduReporter', () => {
  it('auto-detects CI mode from environment', () => {
    process.env.CI = 'true'
    const reporter = ConduReporter.initialize()
    expect(reporter.mode).toBe('ci')
  })

  it('respects NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1'
    const reporter = ConduReporter.initialize()
    expect(reporter.supportsColor).toBe(false)
  })

  it('outputs correct format in quiet mode', () => {
    const output = captureStdout(() => {
      const reporter = ConduReporter.initialize({ mode: 'quiet' })
      reporter.startPhase('applying')
      reporter.printSummary(mockSummary)
    })

    expect(output).toMatch(/✓ \d+ files processed/)
  })
})
```

---

## Recommendation

**For initial implementation, I recommend:**

1. **Start with Option C (Ultra Minimal)** as the default theme
   - Cleanest, most versatile
   - Works well in all environments
   - Easy to enhance later

2. **Implement modes in this order:**
   - CI mode first (simplest, most stable)
   - Local mode next (with minimal theme)
   - Quiet mode last (requires spinner handling)

3. **Use singleton pattern** for reporter
   - Export initialized instance: `import reporter from '@condu/reporter'`
   - No need to pass through function parameters
   - Easy to use anywhere in codebase

4. **Progressive enhancement**
   - Start with basic text output
   - Add colors next
   - Then spinners/animations
   - Finally add theme variants

5. **Environment variables**
   - `CONDU_QUIET=true` → quiet mode
   - `CONDU_THEME=retro|modern|minimal` → theme selection
   - `NO_COLOR=1` → disable colors
   - Auto-detect `CI=true` and TTY

This approach provides immediate value while allowing for iterative improvement toward the more stylized options.

---

## Questions for Consideration

1. Should we add a `--json` output mode for machine parsing?
2. Do we want to log to a file in addition to stdout?
3. Should we support different verbosity levels (--verbose, -v, -vv, -vvv)?
4. Should manual conflict resolution be part of the reporter or separate?
5. Do we want telemetry/analytics on which features take longest?

---

## Appendix: Dependencies to Consider

### Minimal approach (recommended):
- No external dependencies, use native Node.js capabilities
- ANSI escape codes directly
- Simple state management

### Enhanced approach:
- `picocolors` or `chalk` - color support (2KB vs 15KB)
- `cli-spinners` - spinner animations
- `cli-progress` - progress bars
- `log-symbols` - consistent symbols across platforms
- `string-width` - proper width calculation for Unicode
- `wrap-ansi` - text wrapping with ANSI support

**Recommendation**: Start with zero dependencies, add `picocolors` only if color logic gets complex.
