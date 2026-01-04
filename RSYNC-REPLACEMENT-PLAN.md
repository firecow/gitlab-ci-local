# Plan: Complete Removal of rsync Dependency

## Problem
- rsync is a system dependency not available in base Node.js containers
- Tests fail in `node:24` container because rsync is missing
- Need to completely remove rsync from the codebase

## All rsync Usages to Replace

### Source Code

| Location | Purpose | Replacement |
|----------|---------|-------------|
| `src/utils.ts:377-459` | `rsyncTrackedFiles()` - sync git-tracked files | `tar-stream` pack/extract |
| `src/handler.ts:131,144,155` | Calls rsyncTrackedFiles before jobs | Keep calls, function changes |
| `src/job.ts:975` | Shell isolation file sync | Use new sync function |
| `src/job.ts:1455` | Copy artifacts to shell-isolation build | `fs-extra.copy()` |
| `src/job.ts:1485` | Copy cache out (inside container) | `tar` + `docker cp` |
| `src/job.ts:1545` | Copy artifacts out (inside container) | `tar` + `docker cp` |
| `src/job.ts:1563` | Copy dotenv reports (inside container) | `tar` + `docker cp` |
| `src/job.ts:1587` | Copy artifacts to source | `fs-extra.copy()` |
| `src/job.ts:1589` | Copy dotenv to source | `fs-extra.copy()` |

### Documentation & Config

| File | Change |
|------|--------|
| `README.md:115` | Remove rsync install requirement |
| `Dockerfile:4` | Remove `apt-get install rsync` |
| `Dockerfile.dev:10` | Remove rsync from install |
| `Dockerfile.helper:6` | Remove `rsync` from apk add (keep bash) |
| `publish-deb:23` | Remove `Depends: rsync` |
| `CHANGELOG.md` | Update rsync caching mentions → "file sync caching" |

## Implementation Strategy

### Phase 1: Add dependencies
```bash
npm install tar-stream
npm install --save-dev @types/tar-stream
```

### Phase 2: Replace rsyncTrackedFiles (utils.ts)

New implementation using `tar-stream`:
1. Get tracked files via `git ls-files`
2. Create tar stream with file contents
3. Extract to target directory
4. Use manifest tracking for delete behavior
5. Keep git state hash caching

### Phase 3: Replace host-side rsync in job.ts

For `copyIn` (line 1455) - shell isolation artifacts:
```typescript
// Replace: rsync -a ${source}/. ${target}
await fs.copy(source, target, { overwrite: true });
```

For `copyArtifactsToSource` (lines 1587, 1589):
```typescript
// Replace: rsync -a ${src}/. ${dst}
await fs.copy(src, dst, { overwrite: true, filter: ... });
```

### Phase 4: Replace container-side rsync

For in-container operations (lines 1485, 1545, 1563), replace rsync with tar:

**Before (rsync in container):**
```bash
rsync -Ra ${paths} ${dest}
```

**After (tar in container):**
```bash
cd ${baseDir} && tar -cf - ${paths} | tar -xf - -C ${dest}
```

This uses tar which is available in all containers (part of busybox/alpine base).

### Phase 5: Update Dockerfiles

Remove rsync from all Docker images since it's no longer needed.

### Phase 6: Update documentation

- Remove rsync from README prerequisites
- Update CHANGELOG references

## Manifest Tracking for Delete Behavior

Store synced file list in `.gitlab-ci-local/sync-manifest-{target}.json`:
```json
{
  "files": ["src/index.ts", "package.json"],
  "stateHash": "abc123-def456-..."
}
```

On each sync:
1. Read previous manifest
2. Get current tracked files
3. Delete orphans (previous - current)
4. Sync new/changed files
5. Write new manifest

## Testing

1. Run full test suite in `node:24` container (no rsync)
2. Verify docker jobs get correct files
3. Test artifacts flow (in/out)
4. Test cache operations
5. Test shell-isolation mode
6. Test `--artifacts-to-source` flag

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `tar-stream` |
| `src/utils.ts` | Rewrite `rsyncTrackedFiles` |
| `src/job.ts` | Replace 6 rsync usages |
| `Dockerfile` | Remove rsync |
| `Dockerfile.dev` | Remove rsync |
| `Dockerfile.helper` | Remove rsync |
| `publish-deb` | Remove rsync dependency |
| `README.md` | Remove rsync prerequisite |
| `CHANGELOG.md` | Update wording |

## Alternative Considered: git clone

**Approach:** `git clone --depth 1 file:///path/to/repo/.git target-dir`

**Why rejected:**
- `git clone` only copies **committed content**
- Does NOT include uncommitted changes to tracked files
- Current behavior (and user requirement): sync files with local edits included
- Users should be able to test changes without committing first

**Why tar-stream was chosen:**
- Reads files directly from filesystem (includes uncommitted edits)
- Works with git ls-files to identify tracked files
- No new system dependencies (Node.js native)
- Supports manifest tracking for incremental updates

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| tar not available in container | tar is in all base images (alpine, debian, etc.) |
| fs.copy slower than rsync | Minimal impact; caching skips unchanged files |
| Symlink handling | tar-stream supports symlinks; fs.copy has dereference option |
| File permissions | tar preserves mode; fs.copy preserves by default |
