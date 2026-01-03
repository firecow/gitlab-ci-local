/**
 * Database schema for gitlab-ci-local web UI
 */

export const SCHEMA = `
-- Pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  iid INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'success', 'failed', 'canceled')),
  started_at INTEGER,
  finished_at INTEGER,
  duration INTEGER,
  cwd TEXT NOT NULL,
  git_ref TEXT,
  git_sha TEXT,
  created_at INTEGER NOT NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_name TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'warning', 'failed', 'canceled')),
  when_condition TEXT,
  allow_failure BOOLEAN DEFAULT 0,
  needs TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  duration INTEGER,
  exit_code INTEGER,
  coverage_percent REAL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
);

-- Job logs table
CREATE TABLE IF NOT EXISTS job_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  stream TEXT NOT NULL CHECK(stream IN ('stdout', 'stderr')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_iid ON pipelines(iid DESC);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_pipeline ON jobs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs(name);

CREATE INDEX IF NOT EXISTS idx_logs_job ON job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_logs_job_line ON job_logs(job_id, line_number);

CREATE INDEX IF NOT EXISTS idx_artifacts_job ON artifacts(job_id);
`;

/**
 * Type definitions for database models
 */

export interface PipelineRow {
    id: string;
    iid: number;
    status: "queued" | "running" | "success" | "failed" | "canceled";
    started_at: number | null;
    finished_at: number | null;
    duration: number | null;
    cwd: string;
    git_ref: string | null;
    git_sha: string | null;
    created_at: number;
}

export interface JobRow {
    id: string;
    pipeline_id: string;
    name: string;
    base_name: string;
    stage: string;
    status: "pending" | "running" | "success" | "warning" | "failed" | "canceled";
    when_condition: string | null;
    allow_failure: number; // SQLite uses 0/1 for boolean
    needs: string | null; // JSON array of job names this job depends on
    started_at: number | null;
    finished_at: number | null;
    duration: number | null;
    exit_code: number | null;
    coverage_percent: number | null;
    created_at: number;
}

export interface LogRow {
    id: number;
    job_id: string;
    line_number: number;
    stream: "stdout" | "stderr";
    content: string;
    timestamp: number;
}

export interface ArtifactRow {
    id: number;
    job_id: string;
    file_path: string;
    size: number | null;
    created_at: number;
}
