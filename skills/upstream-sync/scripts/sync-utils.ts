import path from 'node:path'
import { promises as fs } from 'node:fs'

export const repoRoot = process.cwd()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeKind = 'added' | 'deleted' | 'modified' | 'renamed'

export interface FileChange {
  /** Path relative to repo root (after rename: the new path) */
  path: string
  /** Old path for renames */
  oldPath?: string
  kind: ChangeKind
  linesAdded: number
  linesDeleted: number
  /** Whether the file has local-only modifications (diff against HEAD is non-empty) */
  hasLocalChanges: boolean
}

export interface AssessResult {
  autoMerge: FileChange[]
  manualReview: FileChange[]
}

export interface SyncState {
  upstream_remote: string
  upstream_branch: string
  last_synced_commit: string
  last_sync_time: string | null
  sync_history: SyncHistoryEntry[]
}

export interface SyncHistoryEntry {
  from_commit: string
  to_commit: string
  timestamp: string
  files_changed: number
  auto_merged: number
  manual_required: number
  status: 'completed' | 'partial' | 'failed'
}

// ---------------------------------------------------------------------------
// Path mapping: upstream repo <-> local repo
// ---------------------------------------------------------------------------

export interface PathMapping {
  /** Prefix path in the upstream repo (e.g., "docs/" or "src/examples/") */
  upstream: string
  /** Target directory in the local repo (e.g., "docs/zh/" or "code/") */
  local: string
}

interface MappingConfig {
  exclude?: string[]
  mappings: PathMapping[]
  preserveLocal?: PreserveRule[]
}

export interface PreserveRule {
  /** Human-readable description of what this rule preserves */
  description: string
  /** Regex pattern to match lines that should be preserved from local version */
  pattern: string
  /** Optional glob pattern to limit which files this rule applies to (e.g., "*.md") */
  glob?: string
}

const MAPPING_FILE = path.resolve(repoRoot, '.upstream-mapping.json')

let cachedMappings: PathMapping[] | null = null

export async function loadPathMappings(): Promise<PathMapping[]> {
  if (cachedMappings) return cachedMappings
  const content = await fs.readFile(MAPPING_FILE, 'utf-8')
  const config: MappingConfig = JSON.parse(content)
  if (!Array.isArray(config.mappings) || config.mappings.length === 0) {
    throw new Error('.upstream-mapping.json must have a non-empty "mappings" array')
  }
  // Normalize: ensure directory prefixes end with '/', leave file paths as-is
  cachedMappings = config.mappings.map((m) => ({
    upstream: m.upstream,
    local: m.upstream.endsWith('/') && !m.local.endsWith('/') ? m.local + '/' : m.local
  }))
  return cachedMappings
}

let cachedExcludes: string[] | null = null

export async function loadExcludes(): Promise<string[]> {
  if (cachedExcludes) return cachedExcludes
  const content = await fs.readFile(MAPPING_FILE, 'utf-8')
  const config: MappingConfig = JSON.parse(content)
  cachedExcludes = config.exclude ?? []
  return cachedExcludes
}

let cachedPreserveRules: PreserveRule[] | null = null

export async function loadPreserveRules(): Promise<PreserveRule[]> {
  if (cachedPreserveRules) return cachedPreserveRules
  const content = await fs.readFile(MAPPING_FILE, 'utf-8')
  const config: MappingConfig = JSON.parse(content)
  cachedPreserveRules = config.preserveLocal ?? []
  return cachedPreserveRules
}

/**
 * Check if a file matches a glob pattern (simple matching for *.ext patterns).
 */
function matchesGlob(filePath: string, glob: string): boolean {
  if (glob.startsWith('*.')) {
    const ext = glob.slice(1) // e.g., ".md"
    return filePath.endsWith(ext)
  }
  return filePath === glob
}

/**
 * Merge upstream content with local content, preserving local lines that match preserve rules.
 * For lines matching a preserve pattern, the local version is kept if it differs from upstream.
 */
export function applyPreserveRules(
  upstreamContent: string,
  localContent: string,
  rules: PreserveRule[],
  filePath: string
): { content: string; preservedCount: number } {
  if (rules.length === 0) {
    return { content: upstreamContent, preservedCount: 0 }
  }

  // Filter rules applicable to this file
  const applicableRules = rules.filter(
    (rule) => !rule.glob || matchesGlob(filePath, rule.glob)
  )
  if (applicableRules.length === 0) {
    return { content: upstreamContent, preservedCount: 0 }
  }

  // Compile regex patterns
  const compiledRules = applicableRules.map((rule) => ({
    ...rule,
    regex: new RegExp(rule.pattern)
  }))

  const upstreamLines = upstreamContent.split('\n')
  const localLines = localContent.split('\n')

  // Build a set of local lines that match preserve patterns (for quick lookup)
  const preservedLocalLines = new Set<string>()
  for (const line of localLines) {
    for (const rule of compiledRules) {
      if (rule.regex.test(line)) {
        preservedLocalLines.add(line.trim())
        break
      }
    }
  }

  // Merge: for each upstream line, check if it matches a preserve pattern
  // and if there's a corresponding local line to use instead
  const result: string[] = []
  let preservedCount = 0

  for (const upstreamLine of upstreamLines) {
    let preserved = false
    for (const rule of compiledRules) {
      if (rule.regex.test(upstreamLine)) {
        // This line matches a preserve pattern - check if local has a different version
        const matchingLocal = localLines.find(
          (localLine) =>
            rule.regex.test(localLine) &&
            localLine.trim() !== upstreamLine.trim()
        )
        if (matchingLocal !== undefined) {
          result.push(matchingLocal)
          preservedCount++
          preserved = true
          break
        }
      }
    }
    if (!preserved) {
      result.push(upstreamLine)
    }
  }

  return { content: result.join('\n'), preservedCount }
}

export function isExcludedUpstreamFile(upstreamPath: string, excludes: string[]): boolean {
  return excludes.some((pattern) => {
    if (pattern.endsWith('/')) {
      return upstreamPath.startsWith(pattern) || upstreamPath === pattern.slice(0, -1)
    }
    return upstreamPath === pattern
  })
}

/**
 * Map an upstream file path to its local path.
 * Returns `null` if the file doesn't match any mapping rule.
 */
export function mapUpstreamPath(upstreamPath: string, mappings: PathMapping[]): string | null {
  const normalized = upstreamPath.replace(/\\/g, '/')
  for (const mapping of mappings) {
    if (normalized.startsWith(mapping.upstream)) {
      const relative = normalized.slice(mapping.upstream.length)
      return path.posix.join(mapping.local, relative)
    }
  }
  return null
}

/**
 * Check whether an upstream file path matches any mapping rule.
 */
export function isMappedUpstreamFile(upstreamPath: string, mappings: PathMapping[]): boolean {
  return mapUpstreamPath(upstreamPath, mappings) !== null
}

/**
 * Get the list of local target directories from mappings (directory entries only).
 */
export function getLocalTargetDirs(mappings: PathMapping[]): string[] {
  const dirs = new Set<string>()
  for (const m of mappings) {
    if (m.upstream.endsWith('/')) {
      const dir = m.local.replace(/\/+$/, '')
      dirs.add(dir)
    }
  }
  return [...dirs]
}

/**
 * Get the list of local target files from mappings (file entries only).
 */
export function getLocalTargetFiles(mappings: PathMapping[]): string[] {
  const files: string[] = []
  for (const m of mappings) {
    if (!m.upstream.endsWith('/')) {
      files.push(m.local)
    }
  }
  return files
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

export async function execGit(args: string[]): Promise<string> {
  const { execFile } = await import('node:child_process')
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`git ${args.join(' ')} failed:\n${stderr}`))
        return
      }
      resolve(stdout.trim())
    })
  })
}

export async function getCurrentBranch(): Promise<string> {
  return execGit(['rev-parse', '--abbrev-ref', 'HEAD'])
}

export async function getLatestCommit(remoteRef: string): Promise<string> {
  return execGit(['rev-parse', remoteRef])
}

export async function getCommitMessage(sha: string): Promise<string> {
  return execGit(['log', '-1', '--format=%s', sha])
}

/**
 * Get the list of changed files between two commits.
 * Handles added, deleted, modified, and renamed files.
 */
export async function getFileChanges(fromCommit: string, toCommit: string): Promise<FileChange[]> {
  const numstat = await execGit(['diff', '--numstat', '-M', `${fromCommit}..${toCommit}`])
  if (!numstat) return []

  const changes: FileChange[] = []
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue
    const [added, deleted, ...pathParts] = line.split('\t')
    const rawPath = pathParts.join('\t')

    // Handle renames: "old => new" or "{old => new}"
    const renameMatch = rawPath.match(/^(.+?)\s+=>\s+(.+)$/)
    let filePath: string
    let oldPath: string | undefined
    let kind: ChangeKind = 'modified'

    if (renameMatch) {
      oldPath = renameMatch[1].trim()
      filePath = renameMatch[2].trim()
      kind = 'renamed'
    } else {
      filePath = rawPath
    }

    // Determine kind from numstat
    if (added === '-' && deleted === '-') {
      // Binary file, treat as modified
      kind = kind === 'renamed' ? 'renamed' : 'modified'
    } else if (added === '0' && deleted !== '0' && !oldPath) {
      kind = 'deleted'
    } else if (deleted === '0' && added !== '0' && !oldPath) {
      // Could be newly added or modified with only additions
      // Check if file existed before
      try {
        await execGit(['cat-file', '-e', `${fromCommit}:${filePath}`])
        kind = 'modified'
      } catch {
        kind = 'added'
      }
    }

    changes.push({
      path: filePath,
      oldPath,
      kind,
      linesAdded: added === '-' ? 0 : parseInt(added, 10),
      linesDeleted: deleted === '-' ? 0 : parseInt(deleted, 10),
      hasLocalChanges: false
    })
  }

  return changes
}

/**
 * Check which files have local-only changes (diff between HEAD and working tree or index).
 */
export async function detectLocalChanges(files: string[]): Promise<Set<string>> {
  const changed = new Set<string>()
  if (files.length === 0) return changed

  // Check staged + unstaged changes
  try {
    const diffOutput = await execGit(['diff', '--name-only', 'HEAD', '--', ...files])
    for (const f of diffOutput.split('\n')) {
      if (f.trim()) changed.add(f.trim())
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('bad revision') || message.includes('unknown revision')) {
      // HEAD doesn't exist yet (empty repo), check index instead
      try {
        const diffOutput = await execGit(['diff', '--name-only', '--cached', '--', ...files])
        for (const f of diffOutput.split('\n')) {
          if (f.trim()) changed.add(f.trim())
        }
      } catch {
        // Truly empty repo with no index either — no local changes
      }
    } else {
      throw error
    }
  }

  return changed
}

// ---------------------------------------------------------------------------
// Impact assessment
// ---------------------------------------------------------------------------

const LINES_THRESHOLD = 30

/**
 * Assess which files can be auto-merged and which need manual review.
 */
export async function assessChanges(changes: FileChange[]): Promise<AssessResult> {
  const autoMerge: FileChange[] = []
  const manualReview: FileChange[] = []

  // Detect local changes for files that exist on disk
  const existingFiles = changes
    .filter((c) => c.kind !== 'deleted')
    .map((c) => c.path)
  const localChanges = await detectLocalChanges(existingFiles)

  for (const change of changes) {
    change.hasLocalChanges = localChanges.has(change.path)

    // SUMMARY.md always needs manual review
    if (change.path === 'SUMMARY.md') {
      manualReview.push(change)
      continue
    }

    // Deleted files always need manual review
    if (change.kind === 'deleted') {
      manualReview.push(change)
      continue
    }

    // New files can always be auto-merged (no local conflict possible)
    if (change.kind === 'added') {
      autoMerge.push(change)
      continue
    }

    // Files with local changes need manual review
    if (change.hasLocalChanges) {
      manualReview.push(change)
      continue
    }

    // Large changes need manual review
    const totalChanged = change.linesAdded + change.linesDeleted
    if (totalChanged >= LINES_THRESHOLD) {
      manualReview.push(change)
      continue
    }

    // Small changes can be auto-merged
    autoMerge.push(change)
  }

  return { autoMerge, manualReview }
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

export interface IntegrityCheckResult {
  passed: boolean
  missingFiles: string[]
  emptyFiles: string[]
  newFiles: string[]
  removedFiles: string[]
}

/**
 * Verify file integrity after merge by comparing file lists and checking for empties.
 * @param beforeFiles - Files that existed before the merge
 * @param afterFiles - Files that exist after the merge
 * @param targetDirs - Local directories to check (from mapping config, e.g., ["docs/zh", "code"])
 * @param targetFiles - Individual file targets to check (e.g., ["SUMMARY.md"])
 */
export async function verifyIntegrity(
  beforeFiles: Set<string>,
  afterFiles: Set<string>,
  targetDirs: string[] = ['docs/zh'],
  targetFiles: string[] = []
): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    missingFiles: [],
    emptyFiles: [],
    newFiles: [],
    removedFiles: []
  }

  // Check for files that existed before but are now missing
  for (const f of beforeFiles) {
    if (!afterFiles.has(f)) {
      result.removedFiles.push(f)
    }
  }

  // Check for new files from upstream
  for (const f of afterFiles) {
    if (!beforeFiles.has(f)) {
      result.newFiles.push(f)
    }
  }

  // Check each target directory
  for (const dir of targetDirs) {
    const fullPath = path.resolve(repoRoot, dir)
    try {
      const stat = await fs.stat(fullPath)
      if (!stat.isDirectory()) {
        result.missingFiles.push(dir)
        continue
      }
      // Check for empty .md files in the directory
      const mdFiles = await walkMdFiles(fullPath)
      for (const f of mdFiles) {
        const fstat = await fs.stat(f)
        if (fstat.size === 0) {
          result.emptyFiles.push(path.relative(repoRoot, f))
        }
      }
    } catch {
      result.missingFiles.push(dir)
    }
  }

  // Check individual file targets (e.g., SUMMARY.md)
  for (const file of targetFiles) {
    const fullPath = path.resolve(repoRoot, file)
    try {
      const stat = await fs.stat(fullPath)
      if (stat.size === 0) {
        result.emptyFiles.push(file)
      }
    } catch {
      result.missingFiles.push(file)
    }
  }

  if (result.missingFiles.length > 0 || result.emptyFiles.length > 0) {
    result.passed = false
  }

  return result
}

async function walkMdFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await walkMdFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Get the list of all files in a directory at a given commit.
 */
export async function getFilesAtCommit(commitSha: string, dir: string): Promise<Set<string>> {
  try {
    const output = await execGit(['ls-tree', '-r', '--name-only', commitSha, dir])
    return new Set(output.split('\n').filter(Boolean))
  } catch {
    return new Set()
  }
}

/**
 * Get the list of all files currently on disk in a directory.
 */
export async function getFilesOnDisk(dir: string): Promise<Set<string>> {
  const absDir = path.resolve(repoRoot, dir)
  const files = new Set<string>()
  try {
    await walkAndCollect(absDir, absDir, files)
  } catch {
    // Directory might not exist
  }
  return files
}

async function walkAndCollect(baseDir: string, dir: string, result: Set<string>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await walkAndCollect(baseDir, fullPath, result)
    } else if (entry.isFile()) {
      result.add(path.relative(baseDir, fullPath).replace(/\\/g, '/'))
    }
  }
}

// ---------------------------------------------------------------------------
// Sync state management
// ---------------------------------------------------------------------------

const STATE_FILE = path.resolve(repoRoot, 'sync-state.json')

export async function loadSyncState(): Promise<SyncState> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    return {
      upstream_remote: parsed.upstream_remote ?? 'upstream',
      upstream_branch: parsed.upstream_branch ?? 'main',
      last_synced_commit: parsed.last_synced_commit ?? '',
      last_sync_time: parsed.last_sync_time ?? null,
      sync_history: Array.isArray(parsed.sync_history) ? parsed.sync_history : []
    }
  } catch {
    return {
      upstream_remote: 'upstream',
      upstream_branch: 'main',
      last_synced_commit: '',
      last_sync_time: null,
      sync_history: []
    }
  }
}

export async function saveSyncState(state: SyncState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8')
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

export function formatSyncReport(
  fromCommit: string,
  toCommit: string,
  fromMessage: string,
  toMessage: string,
  assessment: AssessResult,
  integrity: IntegrityCheckResult
): string {
  const lines: string[] = []

  lines.push('# Sync Report')
  lines.push('')
  lines.push(`**From:** \`${fromCommit.slice(0, 8)}\` — ${fromMessage}`)
  lines.push(`**To:**   \`${toCommit.slice(0, 8)}\` — ${toMessage}`)
  lines.push('')

  // Auto-merged
  lines.push(`## Auto-merged (${assessment.autoMerge.length} files)`)
  lines.push('')
  if (assessment.autoMerge.length === 0) {
    lines.push('_No files were auto-merged._')
  } else {
    for (const f of assessment.autoMerge) {
      const sign = f.kind === 'added' ? '+' : f.kind === 'deleted' ? '-' : '~'
      lines.push(`- \`${f.path}\` (${sign} ${f.linesAdded}/${f.linesDeleted})`)
    }
  }
  lines.push('')

  // Manual review
  lines.push(`## Needs Manual Review (${assessment.manualReview.length} files)`)
  lines.push('')
  if (assessment.manualReview.length === 0) {
    lines.push('_No files require manual review._')
  } else {
    for (const f of assessment.manualReview) {
      const reasons: string[] = []
      if (f.hasLocalChanges) reasons.push('has local changes')
      if (f.linesAdded + f.linesDeleted >= LINES_THRESHOLD) reasons.push('large change')
      if (f.kind === 'deleted') reasons.push('file deleted')
      if (f.path === 'SUMMARY.md') reasons.push('structure file')
      lines.push(`- \`${f.path}\` — ${reasons.join(', ')}`)
    }
  }
  lines.push('')

  // Integrity
  lines.push('## Integrity Check')
  lines.push('')
  lines.push(`**Status:** ${integrity.passed ? 'PASSED' : 'FAILED'}`)
  if (integrity.emptyFiles.length > 0) {
    lines.push('')
    lines.push('**Empty files detected:**')
    for (const f of integrity.emptyFiles) {
      lines.push(`- \`${f}\``)
    }
  }
  if (integrity.missingFiles.length > 0) {
    lines.push('')
    lines.push('**Missing critical files:**')
    for (const f of integrity.missingFiles) {
      lines.push(`- \`${f}\``)
    }
  }
  if (integrity.newFiles.length > 0) {
    lines.push('')
    lines.push(`**New files from upstream:** ${integrity.newFiles.length}`)
  }
  if (integrity.removedFiles.length > 0) {
    lines.push('')
    lines.push(`**Files removed by upstream:** ${integrity.removedFiles.length}`)
    for (const f of integrity.removedFiles) {
      lines.push(`- \`${f}\``)
    }
  }

  return lines.join('\n')
}
