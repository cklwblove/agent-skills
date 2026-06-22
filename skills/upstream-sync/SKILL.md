---
name: upstream-sync
description: >
  Synchronize content from an upstream Git repository into the local repo with path mapping,
  conflict detection, and integrity verification. Use when the user asks to sync, merge, or
  pull changes from an upstream/fork repository, or mentions keywords like "upstream sync",
  "sync upstream", "上游同步", "同步上游". Accepts upstream repo URL and starting commit SHA.
---

# Upstream Sync

Sync content from an upstream repository into the local repo, handling different directory structures via path mapping.

## Bundled Scripts

The skill includes sync scripts in `scripts/`:

- `scripts/sync-upstream.ts` — 5-phase sync orchestrator
- `scripts/sync-utils.ts` — path mapping, git helpers, integrity checks

## Workflow

### Step 0: Deploy Scripts to Project

Copy the bundled scripts to the project's `scripts/` directory (skip if already present and up-to-date):

```bash
mkdir -p <PROJECT_ROOT>/scripts
cp <SKILL_DIR>/scripts/sync-upstream.ts <PROJECT_ROOT>/scripts/
cp <SKILL_DIR>/scripts/sync-utils.ts <PROJECT_ROOT>/scripts/
```

The project needs `tsx` in devDependencies. If missing: `npm i -D tsx`.

### Step 1: Configure Upstream Remote

```bash
git remote get-url upstream 2>/dev/null || git remote add upstream <UPSTREAM_URL>
git fetch upstream
```

### Step 2: Generate Path Mappings

Analyze both repos and create `<PROJECT_ROOT>/.upstream-mapping.json`:

```bash
# List upstream root structure
git ls-tree --name-only upstream/main

# List local content directories
ls <PROJECT_ROOT>/docs/
```

Generate mapping config:

```json
{
  "_comment": "Upstream -> local path mapping",
  "exclude": ["README.md"],
  "mappings": [
    { "upstream": "01_intro/", "local": "docs/zh/01_intro/" },
    { "upstream": "02_fundamentals/", "local": "docs/zh/02_fundamentals/" },
    { "upstream": "_images/", "local": "docs/zh/_images/" },
    { "upstream": "SUMMARY.md", "local": "SUMMARY.md" }
  ]
}
```

**Mapping rules:**
- Directory: upstream path ends with `/`, local path ends with `/`
- File: exact paths, no trailing `/`
- `exclude`: upstream paths skipped entirely (never synced)
- First match wins

### Step 3: Initialize State

Create `<PROJECT_ROOT>/sync-state.json` with the starting commit:

```json
{
  "upstream_remote": "upstream",
  "upstream_branch": "main",
  "last_synced_commit": "<STARTING_SHA>",
  "last_sync_time": null,
  "sync_history": []
}
```

### Step 4: Run Sync

```bash
cd <PROJECT_ROOT>
node --import tsx scripts/sync-upstream.ts --from <COMMIT_SHA>
```

| Flag | Description |
|------|-------------|
| `--from <sha>` | Start from this commit (overrides state file) |
| `--dry-run` | Preview only, no changes |
| `--no-fetch` | Skip `git fetch` (data already local) |
| `--skip-build-check` | Skip `npm run docs:build` verification |

### Step 5: Review & Merge

1. Check terminal output for auto-merged vs manual-review files
2. Review `sync-conflict-report.md` for details
3. Handle manual-review files (large diffs >= 30 lines, deleted files, SUMMARY.md):
   ```bash
   git show upstream/main:<upstream-path>   # view upstream version
   # edit local file, then stage + commit
   ```
4. Merge into main:
   ```bash
   git checkout main
   git merge sync/<timestamp>
   git branch -d sync/<timestamp>
   ```

## Auto vs Manual Classification

| Condition | Handling |
|-----------|----------|
| New file (added) | Auto-merge |
| < 30 lines, no local modifications | Auto-merge |
| >= 30 lines changed | Manual review |
| Has local-only modifications | Manual review |
| File deleted upstream | Manual review |
| `SUMMARY.md` | Always manual review |

## Integrity Verification

Post-merge checks:
- Directory targets exist and contain non-empty `.md` files
- File targets exist and are non-empty
- No files lost compared to pre-merge snapshot

## Sync Phases

1. **Prepare** — read state, fetch upstream, detect new commits
2. **Analyse** — diff files, apply path mapping + exclude, classify auto vs manual
3. **Backup** — create `backup/pre-sync-<ts>` and `sync/<ts>` branches
4. **Merge** — file-by-file via `git show <commit>:<path>`, write to mapped local path
5. **Report** — update state, print summary, save report
