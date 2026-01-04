# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Web UI: Initialization progress display** - The web UI now shows real-time progress during pipeline initialization with a progress bar and status messages. Phases include:
  - "Parsing configuration..." (10%)
  - "Processing includes..." (30%)
  - "Creating job definitions..." (60%)
  - "Checking for file changes..." / "Syncing tracked files..." (70-80%)
  - "Ready to run jobs" (100%)

- **Rsync caching for faster subsequent runs** - When running docker jobs, the rsync operation now caches file state using git hashes. If no files have changed since the last run (same git HEAD, no uncommitted changes, no new untracked files), the rsync step is skipped entirely. Cache state is stored in `.gitlab-ci-local/rsync-cache-{target}.txt`.

### Fixed

- **Web UI: Pipeline IID synchronization** - Fixed issue where clicking "Run Pipeline" in the web UI would create separate pipeline records for the queued pipeline and job events. The web server now passes the pipeline IID to the subprocess via `GCIL_PIPELINE_IID` environment variable, ensuring jobs are associated with the correct pipeline record.

### Changed

- **Database schema** - Added `init_phase`, `init_message`, and `init_progress` columns to the pipelines table to track initialization state. Existing databases are automatically migrated.

### Technical Details

- New `PIPELINE_INIT_PHASE` event type for tracking initialization progress
- `PipelineInitEvent` interface with `phase`, `message`, and optional `progress` fields
- Parser emits events during YAML parsing, include processing, and job creation
- `Utils.rsyncTrackedFiles()` now accepts optional `pipelineIid` parameter and returns `{hrdeltatime, skipped}`
- Frontend displays spinner and progress bar during initialization when pipeline status is "queued"
