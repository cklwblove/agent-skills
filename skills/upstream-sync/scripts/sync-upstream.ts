/**
 * sync-upstream.ts
 *
 * Synchronises upstream content into this repository.
 *
 * Phases:
 *   1. Prepare  — read state, fetch upstream, detect new commits
 *   2. Analyse  — diff files, apply path mapping, classify auto vs manual
 *   3. Backup   — create backup & work branches
 *   4. Merge    — merge upstream, resolve auto files, flag manual ones
 *   5. Report   — update state, print summary
 *
 * Usage:
 *   npx tsx scripts/sync-upstream.ts [--from <sha>] [--dry-run] [--skip-build-check]
 *
 * Options:
 *   --from <sha>       Start sync from this commit (overrides sync-state.json)
 *   --dry-run          Preview changes without modifying anything
 *   --skip-build-check Skip npm run docs:build verification after merge
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import {
  type FileChange,
  type PathMapping,
  type SyncState,
  type UnmappedChange,
  repoRoot,
  loadPathMappings,
  loadExcludes,
  loadPreserveRules,
  isExcludedUpstreamFile,
  mapUpstreamPath,
  getLocalTargetDirs,
  getLocalTargetFiles,
  suggestMappingsForUnmapped,
  isSummaryFile,
  execGit,
  getCurrentBranch,
  getLatestCommit,
  getCommitMessage,
  getFileChanges,
  assessChanges,
  verifyIntegrity,
  getFilesAtCommit,
  getFilesOnDisk,
  loadSyncState,
  saveSyncState,
  formatSyncReport,
  applyPreserveRules
} from './sync-utils'

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_BUILD_CHECK = args.includes('--skip-build-check')

function getFlagValue(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  return undefined
}

const FROM_COMMIT = getFlagValue('--from')
const NO_FETCH = args.includes('--no-fetch')

// ---------------------------------------------------------------------------
// Merge-in-progress tracking (for SIGINT cleanup)
// ---------------------------------------------------------------------------

let mergeInProgress = false

function setupCleanup() {
  const cleanup = async () => {
    if (mergeInProgress) {
      console.warn('\n[sync] Interrupted during merge. Aborting...')
      try {
        await execGit(['merge', '--abort'])
      } catch {
        // ignore
      }
    }
    process.exit(1)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[sync] ${msg}`)
}

function warn(msg: string) {
  console.warn(`[sync] ⚠  ${msg}`)
}

function err(msg: string): never {
  console.error(`[sync] ✗  ${msg}`)
  process.exit(1)
  throw new Error(msg) // unreachable, satisfies TypeScript without @types/node
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

// ---------------------------------------------------------------------------
// Phase 1: Prepare
// ---------------------------------------------------------------------------

async function phasePrepare() {
  log('Phase 1: Prepare')

  const state = await loadSyncState()
  const remoteName = state.upstream_remote
  const remoteBranch = state.upstream_branch
  const remoteRef = `${remoteName}/${remoteBranch}`

  // Verify upstream remote exists
  try {
    await execGit(['remote', 'get-url', remoteName])
  } catch {
    err(
      `Upstream remote "${remoteName}" not found.\n` +
      `Add it first: git remote add ${remoteName} <upstream-repo-url>`
    )
  }

  // Ensure clean working tree before switching branches
  const currentBranch = await getCurrentBranch()
  if (currentBranch !== 'main') {
    const status = await execGit(['status', '--porcelain'])
    if (status.trim()) {
      err(
        `Working tree is not clean on branch "${currentBranch}".\n` +
        `Commit or stash your changes before running sync.`
      )
    }
    log(`Switching from "${currentBranch}" to main.`)
    await execGit(['checkout', 'main'])
  }

  // Fetch upstream (skip if --no-fetch)
  if (!NO_FETCH) {
    log(`Fetching ${remoteName}...`)
    await execGit(['fetch', remoteName])
  } else {
    log('Skipping fetch (--no-fetch)')
  }

  // Determine from-commit: CLI --from > sync-state.json > HEAD
  const latestUpstream = await getLatestCommit(remoteRef)
  let fromCommit: string

  if (FROM_COMMIT) {
    // Validate the provided commit exists on the remote
    try {
      await execGit(['cat-file', '-e', FROM_COMMIT])
      fromCommit = FROM_COMMIT
      log(`Using --from commit: ${fromCommit.slice(0, 8)}`)
    } catch {
      // Maybe user provided a short SHA — try to resolve it
      try {
        fromCommit = await execGit(['rev-parse', FROM_COMMIT])
        log(`Resolved --from to: ${fromCommit.slice(0, 8)}`)
      } catch {
        err(`Commit "${FROM_COMMIT}" not found. Provide a valid commit SHA.`)
      }
    }
  } else if (state.last_synced_commit) {
    fromCommit = state.last_synced_commit
    log(`Resuming from last synced commit: ${fromCommit.slice(0, 8)}`)
  } else {
    fromCommit = await execGit(['rev-parse', 'HEAD'])
    log(`No previous sync found. Starting from HEAD: ${fromCommit.slice(0, 8)}`)
  }

  if (fromCommit === latestUpstream) {
    log('Already up-to-date. Nothing to sync.')
    process.exit(0)
  }

  const fromMessage = await getCommitMessage(fromCommit)
  const toMessage = await getCommitMessage(latestUpstream)

  log(`From: ${fromCommit.slice(0, 8)} — ${fromMessage}`)
  log(`To:   ${latestUpstream.slice(0, 8)} — ${toMessage}`)

  return { state, remoteRef, fromCommit, latestUpstream, fromMessage, toMessage }
}

// ---------------------------------------------------------------------------
// Phase 2: Analyse (with path mapping)
// ---------------------------------------------------------------------------

interface MappedChange extends FileChange {
  /** Local path after applying mapping (null if unmapped) */
  localPath: string | null
}

async function phaseAnalyse(fromCommit: string, toCommit: string) {
  log('Phase 2: Analyse changes')

  const mappings = await loadPathMappings()
  const excludes = await loadExcludes()
  log(`Path mappings loaded: ${mappings.length} rules`)
  for (const m of mappings) {
    log(`  ${m.upstream} -> ${m.local}`)
  }
  if (excludes.length > 0) {
    log(`Excluded upstream paths: ${excludes.join(', ')}`)
  }

  const allChanges = await getFileChanges(fromCommit, toCommit)
  log(`Total files changed upstream: ${allChanges.length}`)

  // Apply path mapping and filter to only mapped files
  const mappedChanges: MappedChange[] = []
  const unmappedUpstream: UnmappedChange[] = []
  const excludedUpstream: string[] = []

  for (const change of allChanges) {
    if (isExcludedUpstreamFile(change.path, excludes)) {
      excludedUpstream.push(change.path)
      continue
    }
    const localPath = mapUpstreamPath(change.path, mappings)
    if (localPath) {
      mappedChanges.push({ ...change, localPath })
    } else {
      unmappedUpstream.push({ path: change.path, kind: change.kind })
    }
  }

  if (excludedUpstream.length > 0) {
    log(`${excludedUpstream.length} upstream files excluded: ${excludedUpstream.join(', ')}`)
  }

  const suggestedMappings = suggestMappingsForUnmapped(
    unmappedUpstream.map((u) => u.path),
    mappings
  )

  if (unmappedUpstream.length > 0) {
    warn(`${unmappedUpstream.length} upstream files have no mapping (NOT synced):`)
    for (const u of unmappedUpstream) {
      const sign = u.kind === 'added' ? '+' : u.kind === 'deleted' ? '-' : u.kind === 'renamed' ? '>' : '~'
      console.log(`    ${sign} ${u.path}  (${u.kind})`)
    }
    if (suggestedMappings.length > 0) {
      warn('Suggested .upstream-mapping.json entries:')
      console.log(JSON.stringify(suggestedMappings, null, 2))
      warn('Add these mappings and re-run sync to pull new upstream paths.')
    }
  }

  log(`Mapped files to sync: ${mappedChanges.length}`)

  if (mappedChanges.length === 0) {
    if (unmappedUpstream.length > 0) {
      warn('No mappable file changes. Only unmapped upstream paths found — update mappings and retry.')
      // Still write a lightweight report so the operator has the suggested mappings
      const report = formatSyncReport(
        fromCommit,
        toCommit,
        await getCommitMessage(fromCommit),
        await getCommitMessage(toCommit),
        { autoMerge: [], manualReview: [] },
        { passed: true, missingFiles: [], emptyFiles: [], newFiles: [], removedFiles: [] },
        unmappedUpstream,
        suggestedMappings
      )
      if (!DRY_RUN) {
        await fs.writeFile(path.resolve(repoRoot, 'sync-conflict-report.md'), report, 'utf-8')
        log('Report saved to: sync-conflict-report.md')
      } else {
        console.log('\n' + report)
      }
    } else {
      log('No mappable file changes detected.')
    }
    process.exit(0)
  }

  // Update FileChange paths to local paths for assessment
  const localChanges: FileChange[] = mappedChanges.map((mc) => ({
    ...mc,
    path: mc.localPath!
  }))

  const assessment = await assessChanges(localChanges)

  log(`Auto-merge: ${assessment.autoMerge.length} files`)
  log(`Manual review: ${assessment.manualReview.length} files`)

  const addedAuto = assessment.autoMerge.filter((f) => f.kind === 'added' || f.kind === 'renamed')
  if (addedAuto.length > 0) {
    log(`New/renamed files to add: ${addedAuto.length}`)
    for (const f of addedAuto) {
      console.log(`    + ${f.path}  (${f.kind})`)
    }
  }

  if (assessment.manualReview.length > 0) {
    warn('The following files need manual review:')
    for (const f of assessment.manualReview) {
      const reasons: string[] = []
      if (f.hasLocalChanges) reasons.push('local changes')
      if (f.linesAdded + f.linesDeleted >= 30) reasons.push('large diff')
      if (f.kind === 'deleted') reasons.push('deleted')
      if (isSummaryFile(f.path)) reasons.push('structure file')
      console.log(`    - ${f.path}  (${reasons.join(', ') || f.kind})`)
    }
  }

  return { mappedChanges, assessment, mappings, unmappedUpstream, suggestedMappings }
}

// ---------------------------------------------------------------------------
// Phase 3: Backup
// ---------------------------------------------------------------------------

async function phaseBackup() {
  log('Phase 3: Create backup branches')

  const ts = timestamp()
  const backupBranch = `backup/pre-sync-${ts}`
  const syncBranch = `sync/${ts}`

  if (DRY_RUN) {
    log(`[dry-run] Would create: ${backupBranch}, ${syncBranch}`)
    return { backupBranch, syncBranch }
  }

  await execGit(['branch', backupBranch])
  log(`Created backup branch: ${backupBranch}`)

  await execGit(['checkout', '-b', syncBranch])
  log(`Created sync branch: ${syncBranch}`)

  return { backupBranch, syncBranch }
}

// ---------------------------------------------------------------------------
// Phase 4: Merge (with path mapping)
// ---------------------------------------------------------------------------

async function phaseMerge(
  remoteRef: string,
  state: SyncState,
  fromCommit: string,
  toCommit: string,
  mappedChanges: MappedChange[],
  assessment: { autoMerge: FileChange[]; manualReview: FileChange[] },
  mappings: PathMapping[]
) {
  log('Phase 4: Apply upstream changes')

  if (DRY_RUN) {
    log('[dry-run] Would apply upstream changes file by file')
    for (const f of assessment.autoMerge) {
      const action =
        f.kind === 'added' ? 'ADD' : f.kind === 'renamed' ? 'RENAME→ADD' : f.kind === 'deleted' ? 'DELETE' : 'UPDATE'
      console.log(`    [dry-run] ${action} ${f.path}`)
    }
    return
  }

  mergeInProgress = true

  // Load preserve rules
  const preserveRules = await loadPreserveRules()
  if (preserveRules.length > 0) {
    log(`Preserve rules loaded: ${preserveRules.length} rules`)
    for (const rule of preserveRules) {
      log(`  - ${rule.description}`)
    }
  }

  // Snapshot the file list before merge (for integrity check)
  const targetDirs = getLocalTargetDirs(mappings)
  const targetFiles = getLocalTargetFiles(mappings)
  const filesBefore = new Set<string>()
  for (const dir of targetDirs) {
    const dirFiles = await getFilesOnDisk(dir)
    for (const f of dirFiles) {
      filesBefore.add(`${dir}/${f}`)
    }
  }
  for (const f of targetFiles) {
    filesBefore.add(f)
  }

  try {
    const autoMergeLocals = new Set(assessment.autoMerge.map((f) => f.path))
    const manualReviewLocals = new Set(assessment.manualReview.map((f) => f.path))

    let appliedCount = 0
    let addedCount = 0
    let skippedCount = 0
    let preservedCount = 0
    const stagedPaths = new Set<string>()

    for (const mc of mappedChanges) {
      if (!mc.localPath) continue

      const localAbs = path.resolve(repoRoot, mc.localPath)

      // Manual-review first — including deleted files (keep local until reviewed)
      if (manualReviewLocals.has(mc.localPath)) {
        warn(`  Skipped (needs manual review): ${mc.localPath}${mc.kind === 'deleted' ? ' [upstream deleted]' : ''}`)
        skippedCount++
        continue
      }

      // Only auto-merge set proceeds
      if (!autoMergeLocals.has(mc.localPath)) {
        warn(`  Skipped (not in auto-merge set): ${mc.localPath}`)
        skippedCount++
        continue
      }

      // Deleted (only if somehow auto-merged — currently never; kept for safety)
      if (mc.kind === 'deleted') {
        try {
          await fs.unlink(localAbs)
          log(`  Deleted: ${mc.localPath}`)
          stagedPaths.add(mc.localPath)
        } catch {
          // Already gone
        }
        appliedCount++
        continue
      }

      // Renamed: remove old local path when it maps
      if (mc.kind === 'renamed' && mc.oldPath) {
        const oldLocal = mapUpstreamPath(mc.oldPath, mappings)
        if (oldLocal && oldLocal !== mc.localPath) {
          try {
            await fs.unlink(path.resolve(repoRoot, oldLocal))
            log(`  Removed old path after rename: ${oldLocal}`)
            stagedPaths.add(oldLocal)
          } catch {
            // Old path already absent
          }
        }
      }

      // Auto-merge: fetch upstream content and write to local path (covers added + modified + renamed)
      try {
        const upstreamContent = await execGit(['show', `${toCommit}:${mc.path}`])
        const localDir = path.dirname(localAbs)
        await fs.mkdir(localDir, { recursive: true })

        let finalContent = upstreamContent
        let isNewFile = false
        try {
          await fs.access(localAbs)
        } catch {
          isNewFile = true
        }

        if (preserveRules.length > 0 && !isNewFile) {
          try {
            const localContent = await fs.readFile(localAbs, 'utf-8')
            const { content, preservedCount: count } = applyPreserveRules(
              upstreamContent,
              localContent,
              preserveRules,
              mc.localPath
            )
            finalContent = content
            if (count > 0) {
              log(`  Preserved ${count} local lines in: ${mc.localPath}`)
              preservedCount += count
            }
          } catch {
            // Fall through with upstream content
          }
        }

        await fs.writeFile(localAbs, finalContent.endsWith('\n') ? finalContent : finalContent + '\n', 'utf-8')
        stagedPaths.add(mc.localPath)
        appliedCount++
        if (isNewFile || mc.kind === 'added' || mc.kind === 'renamed') {
          addedCount++
          log(`  Added: ${mc.localPath}`)
        } else {
          log(`  Updated: ${mc.localPath}`)
        }
      } catch {
        warn(`  Failed to fetch upstream file: ${mc.path}`)
        skippedCount++
      }
    }

    log(
      `Applied: ${appliedCount} files (${addedCount} new), Skipped: ${skippedCount}, Preserved: ${preservedCount} local lines`
    )

    // Integrity check
    const filesAfter = new Set<string>()
    for (const dir of targetDirs) {
      const dirFiles = await getFilesOnDisk(dir)
      for (const f of dirFiles) {
        filesAfter.add(`${dir}/${f}`)
      }
    }
    for (const f of targetFiles) {
      try {
        await fs.access(path.resolve(repoRoot, f))
        filesAfter.add(f)
      } catch {
        // absent
      }
    }
    const integrity = await verifyIntegrity(filesBefore, filesAfter, targetDirs, targetFiles)

    if (!integrity.passed) {
      warn('Integrity check FAILED:')
      if (integrity.emptyFiles.length > 0) {
        for (const f of integrity.emptyFiles) warn(`  Empty file: ${f}`)
      }
      if (integrity.missingFiles.length > 0) {
        for (const f of integrity.missingFiles) warn(`  Missing: ${f}`)
      }
      warn('Review the issues above before committing.')
    } else {
      log('Integrity check PASSED')
      if (integrity.newFiles.length > 0) {
        log(`Integrity: ${integrity.newFiles.length} new local files detected`)
      }
    }

    // Build verification (optional)
    if (!SKIP_BUILD_CHECK) {
      log('Running build verification...')
      try {
        const { execFile } = await import('node:child_process')
        await new Promise<void>((resolve, reject) => {
          execFile('npm', ['run', 'docs:build'], { cwd: repoRoot }, (error, _stdout, stderr) => {
            if (error) {
              warn(`Build failed:\n${stderr}`)
              reject(error)
              return
            }
            resolve()
          })
        })
        log('Build verification PASSED')
      } catch {
        warn('Build verification FAILED. Review changes before committing.')
      }
    }

    // Update sync state BEFORE committing so it's included in the commit
    state.last_synced_commit = toCommit
    state.last_sync_time = new Date().toISOString()
    state.sync_history.push({
      from_commit: fromCommit,
      to_commit: toCommit,
      timestamp: new Date().toISOString(),
      files_changed: assessment.autoMerge.length + assessment.manualReview.length,
      auto_merged: assessment.autoMerge.length,
      manual_required: assessment.manualReview.length,
      status: 'completed'
    })
    if (state.sync_history.length > 50) {
      state.sync_history = state.sync_history.slice(-50)
    }
    await saveSyncState(state)

    // Commit: stage sync-state + mapped dirs + mapped files + every applied path
    await execGit(['add', 'sync-state.json'])
    for (const dir of targetDirs) {
      try {
        await execGit(['add', '--', dir])
      } catch {
        warn(`  Could not stage directory: ${dir}`)
      }
    }
    for (const f of targetFiles) {
      try {
        await execGit(['add', '--', f])
      } catch {
        // file may be absent (manual review skipped)
      }
    }
    for (const p of stagedPaths) {
      try {
        await execGit(['add', '--', p])
      } catch {
        warn(`  Could not stage: ${p}`)
      }
    }

    const autoCount = assessment.autoMerge.length
    const manualCount = assessment.manualReview.length
    const commitMsg = `sync: merge upstream (${autoCount} auto, ${manualCount} manual review, ${addedCount} added)`
    await execGit(['commit', '-m', commitMsg])
    log(`Committed: ${commitMsg}`)
  } catch (error) {
    warn('Sync phase failed. Cleaning up...')
    try {
      await execGit(['reset', '--hard', 'HEAD'])
    } catch {
      // Nothing we can do
    }
    mergeInProgress = false
    throw error
  }

  mergeInProgress = false
}

// ---------------------------------------------------------------------------
// Phase 5: Report
// ---------------------------------------------------------------------------

async function phaseReport(
  state: SyncState,
  fromCommit: string,
  toCommit: string,
  fromMessage: string,
  toMessage: string,
  assessment: { autoMerge: FileChange[]; manualReview: FileChange[] },
  mappings: PathMapping[],
  backupBranch: string,
  syncBranch: string,
  unmappedUpstream: UnmappedChange[] = [],
  suggestedMappings: PathMapping[] = []
) {
  log('Phase 5: Report')

  // Integrity check on final state
  const targetDirs = getLocalTargetDirs(mappings)
  const targetFiles = getLocalTargetFiles(mappings)
  const filesAfter = new Set<string>()
  for (const dir of targetDirs) {
    const dirFiles = await getFilesOnDisk(dir)
    for (const f of dirFiles) {
      filesAfter.add(`${dir}/${f}`)
    }
  }
  for (const f of targetFiles) {
    try {
      await fs.access(path.resolve(repoRoot, f))
      filesAfter.add(f)
    } catch {
      // absent
    }
  }
  const filesBefore = await getFilesAtCommit(fromCommit, targetDirs[0] || 'docs/zh')
  const integrity = await verifyIntegrity(filesBefore, filesAfter, targetDirs, targetFiles)

  // Print report
  const report = formatSyncReport(
    fromCommit,
    toCommit,
    fromMessage,
    toMessage,
    assessment,
    integrity,
    unmappedUpstream,
    suggestedMappings
  )
  console.log('\n' + report)

  // Save report to file (not committed — it's a working artifact)
  const reportPath = path.resolve(repoRoot, 'sync-conflict-report.md')
  await fs.writeFile(reportPath, report, 'utf-8')
  log(`Report saved to: sync-conflict-report.md`)

  // Final summary
  console.log('\n' + '='.repeat(60))
  log('Sync complete!')
  log(`Backup branch: ${backupBranch}`)
  log(`Sync branch:   ${syncBranch}`)
  if (unmappedUpstream.length > 0) {
    warn(`${unmappedUpstream.length} unmapped upstream paths were NOT synced.`)
    warn('Update .upstream-mapping.json (see suggested entries in the report), then re-run.')
  }
  if (assessment.manualReview.length > 0) {
    warn(`${assessment.manualReview.length} files need manual review.`)
    warn('Review them, then merge sync branch into main:')
    console.log(`    git checkout main`)
    console.log(`    git merge ${syncBranch}`)
  } else if (unmappedUpstream.length === 0) {
    log('All mapped files were auto-merged. Merge sync branch into main:')
    console.log(`    git checkout main`)
    console.log(`    git merge ${syncBranch}`)
  }
  console.log('')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  setupCleanup()

  console.log('')
  log('=== Upstream Sync ===')
  if (DRY_RUN) log('[DRY RUN — no changes will be made]')
  if (FROM_COMMIT) log(`[From commit: ${FROM_COMMIT}]`)
  console.log('')

  // Phase 1
  const { state, remoteRef, fromCommit, latestUpstream, fromMessage, toMessage } = await phasePrepare()

  // Phase 2
  const { mappedChanges, assessment, mappings, unmappedUpstream, suggestedMappings } =
    await phaseAnalyse(fromCommit, latestUpstream)

  // Phase 3
  const { backupBranch, syncBranch } = await phaseBackup()

  // Phase 4
  await phaseMerge(remoteRef, state, fromCommit, latestUpstream, mappedChanges, assessment, mappings)

  // Phase 5
  await phaseReport(
    state,
    fromCommit,
    latestUpstream,
    fromMessage,
    toMessage,
    assessment,
    mappings,
    backupBranch,
    syncBranch,
    unmappedUpstream,
    suggestedMappings
  )
}

main().catch((error) => {
  console.error('[sync] Fatal error:', error)
  process.exit(1)
})
