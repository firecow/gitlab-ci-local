// @ts-expect-error - sql.js lacks type declarations, using asm.js version for portability (no WASM needed)
import initSqlJs from "sql.js/dist/sql-asm.js";
import {SCHEMA, PipelineRow, JobRow, LogRow, ArtifactRow} from "./schema.js";
import fs from "fs-extra";
import path from "path";

// Type definitions for sql.js
interface SqlJsDatabase {
    run(sql: string, params?: any[]): void;
    exec(sql: string, params?: any[]): Array<{columns: string[]; values: any[][]}>;
    export(): Uint8Array;
    close(): void;
}

interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

// Cached SQL.js constructor to avoid repeated initialization (memory leak fix)
let cachedSQL: SqlJsStatic | null = null;

async function getSqlJs (): Promise<SqlJsStatic> {
    if (!cachedSQL) {
        cachedSQL = await initSqlJs();
    }
    return cachedSQL!;
}

// Database wrapper for gitlab-ci-local web UI using sql.js (pure JS, portable)
export class GCLDatabase {
    private db: SqlJsDatabase | null = null;
    private dbPath: string;
    private logBuffer: Map<string, LogRow[]> = new Map();
    private logBufferTimeout: NodeJS.Timeout | null = null;
    private readonly LOG_BUFFER_SIZE = 10;
    private readonly LOG_BUFFER_TIMEOUT_MS = 100;
    private saveTimeout: NodeJS.Timeout | null = null;

    constructor (dbPath: string) {
        this.dbPath = dbPath;
    }

    // Initialize database asynchronously
    async init (): Promise<void> {
        const SQL = await getSqlJs();

        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        fs.ensureDirSync(dir);

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            try {
                const buffer = fs.readFileSync(this.dbPath);
                this.db = new SQL.Database(buffer);
                // Verify database is valid
                this.db!.exec("SELECT 1");
            } catch (error) {
                // Database is corrupt, backup and create new one
                console.warn("Database appears corrupt, creating new database:", error);
                const backupPath = this.dbPath + ".corrupt." + Date.now();
                try {
                    fs.renameSync(this.dbPath, backupPath);
                    console.log("Corrupt database backed up to:", backupPath);
                } catch {
                    // Ignore backup errors
                }
                this.db = new SQL.Database();
            }
        } else {
            this.db = new SQL.Database();
        }

        // Initialize schema
        this.db!.run(SCHEMA);

        // Run migrations for existing databases
        this.runMigrations();

        this.save();
    }

    // Run database migrations for schema changes
    private runMigrations () {
        if (!this.db) return;

        // Migration: Add 'needs' column to jobs table if it doesn't exist
        try {
            // Check if column exists by trying to query it
            this.db.exec("SELECT needs FROM jobs LIMIT 1");
        } catch {
            // Column doesn't exist, add it
            try {
                this.db.run("ALTER TABLE jobs ADD COLUMN needs TEXT");
                console.log("Migration: Added needs column to jobs table");
            } catch {
                // Ignore if it already exists
            }
        }

        // Migration: Add init_phase, init_message, init_progress columns to pipelines table
        try {
            this.db.exec("SELECT init_phase FROM pipelines LIMIT 1");
        } catch {
            try {
                this.db.run("ALTER TABLE pipelines ADD COLUMN init_phase TEXT");
                this.db.run("ALTER TABLE pipelines ADD COLUMN init_message TEXT");
                this.db.run("ALTER TABLE pipelines ADD COLUMN init_progress INTEGER");
                console.log("Migration: Added init_phase, init_message, init_progress columns to pipelines table");
            } catch {
                // Ignore if columns already exist
            }
        }
    }

    // Save database to file (atomic write to prevent corruption)
    private save () {
        if (!this.db) return;
        const data = this.db.export();
        const buffer = Buffer.from(data);
        // Write to temp file first, then rename atomically
        const tempPath = this.dbPath + ".tmp";
        fs.writeFileSync(tempPath, buffer);
        fs.renameSync(tempPath, this.dbPath);
    }

    // Schedule a save (debounced)
    private scheduleSave () {
        if (this.saveTimeout) return;
        this.saveTimeout = setTimeout(() => {
            this.save();
            this.saveTimeout = null;
        }, 100);
    }

    // Close database and flush pending data
    close () {
        this.flushLogs();
        this.save();
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // Reload database from disk (for picking up changes from other processes)
    async reload (): Promise<void> {
        if (!this.db) return;

        // Flush any pending data first
        this.flushLogs();
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.save();
            this.saveTimeout = null;
        }

        // Re-read from disk
        if (fs.existsSync(this.dbPath)) {
            const SQL = await getSqlJs();
            try {
                const buffer = fs.readFileSync(this.dbPath);
                const oldDb = this.db;
                this.db = new SQL.Database(buffer);
                // Verify database is valid by running a simple query
                this.db!.exec("SELECT 1");
                oldDb.close();
            } catch (error) {
                // Database file may be corrupt or being written to, keep current in-memory state
                console.warn("Failed to reload database, keeping current state:", error);
            }
        }
    }

    // Helper to get single row
    private getOne<T>(sql: string, params: any[] = []): T | null {
        if (!this.db) return null;
        const result = this.db.exec(sql, params);
        if (result.length === 0 || result[0].values.length === 0) return null;
        const columns = result[0].columns;
        const values = result[0].values[0];
        const row: any = {};
        columns.forEach((col: string, i: number) => row[col] = values[i]);
        return row as T;
    }

    // Helper to get multiple rows
    private getAll<T>(sql: string, params: any[] = []): T[] {
        if (!this.db) return [];
        const result = this.db.exec(sql, params);
        if (result.length === 0) return [];
        const columns = result[0].columns;
        return result[0].values.map(values => {
            const row: any = {};
            columns.forEach((col: string, i: number) => row[col] = values[i]);
            return row as T;
        });
    }

    // ==================== Pipeline Operations ====================

    createPipeline (pipeline: Omit<PipelineRow, "created_at"> & {created_at?: number}): PipelineRow {
        if (!this.db) throw new Error("Database not initialized");

        const row = {
            ...pipeline,
            created_at: pipeline.created_at ?? Date.now(),
        };

        this.db.run(`
            INSERT INTO pipelines (id, iid, status, started_at, finished_at, duration, cwd, git_ref, git_sha, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [row.id, row.iid, row.status, row.started_at, row.finished_at, row.duration, row.cwd, row.git_ref, row.git_sha, row.created_at]);

        // Auto-cleanup: keep only the 20 most recent pipelines
        const count = this.getPipelineCount();
        if (count > 20) {
            this.deleteOldPipelines(20);
        }

        this.scheduleSave();
        return row as PipelineRow;
    }

    updatePipeline (id: string, updates: Partial<Omit<PipelineRow, "id" | "iid" | "created_at">>) {
        if (!this.db) return;

        const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
        const values = Object.values(updates);
        this.db.run(`UPDATE pipelines SET ${fields} WHERE id = ?`, [...values, id]);
        this.scheduleSave();
    }

    getPipeline (id: string): PipelineRow | null {
        return this.getOne<PipelineRow>("SELECT * FROM pipelines WHERE id = ?", [id]);
    }

    getPipelineByIid (iid: number): PipelineRow | null {
        return this.getOne<PipelineRow>("SELECT * FROM pipelines WHERE iid = ? ORDER BY created_at DESC LIMIT 1", [iid]);
    }

    getRecentPipelines (limit: number = 20, offset: number = 0): PipelineRow[] {
        return this.getAll<PipelineRow>("SELECT * FROM pipelines ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset]);
    }

    getPipelineCount (): number {
        const result = this.getOne<{count: number}>("SELECT COUNT(*) as count FROM pipelines", []);
        return result?.count ?? 0;
    }

    getNextPipelineIid (): number {
        const result = this.getOne<{max_iid: number | null}>("SELECT MAX(iid) as max_iid FROM pipelines", []);
        return (result?.max_iid ?? 0) + 1;
    }

    deleteOldPipelines (keep: number = 20) {
        if (!this.db) return;
        this.db.run(`
            DELETE FROM pipelines
            WHERE id NOT IN (
                SELECT id FROM pipelines ORDER BY created_at DESC LIMIT ?
            )
        `, [keep]);
        this.scheduleSave();
    }

    // ==================== Job Operations ====================

    createJob (job: Omit<JobRow, "created_at"> & {created_at?: number}): JobRow {
        if (!this.db) throw new Error("Database not initialized");

        const row = {
            ...job,
            allow_failure: job.allow_failure ? 1 : 0,
            created_at: job.created_at ?? Date.now(),
        };

        this.db.run(`
            INSERT INTO jobs (id, pipeline_id, name, base_name, stage, status, when_condition, allow_failure, needs, started_at, finished_at, duration, exit_code, coverage_percent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [row.id, row.pipeline_id, row.name, row.base_name, row.stage, row.status, row.when_condition, row.allow_failure, row.needs, row.started_at, row.finished_at, row.duration, row.exit_code, row.coverage_percent, row.created_at]);

        this.scheduleSave();
        return row;
    }

    updateJob (id: string, updates: Partial<Omit<JobRow, "id" | "pipeline_id" | "created_at">>) {
        if (!this.db) return;

        const data = {...updates};
        if ("allow_failure" in data) {
            (data as any).allow_failure = data.allow_failure ? 1 : 0;
        }

        const fields = Object.keys(data).map(k => `${k} = ?`).join(", ");
        const values = Object.values(data);
        this.db.run(`UPDATE jobs SET ${fields} WHERE id = ?`, [...values, id]);
        this.scheduleSave();
    }

    getJob (id: string): JobRow | null {
        return this.getOne<JobRow>("SELECT * FROM jobs WHERE id = ?", [id]);
    }

    getJobByPipelineAndName (pipelineId: string, name: string): JobRow | null {
        return this.getOne<JobRow>("SELECT * FROM jobs WHERE pipeline_id = ? AND name = ?", [pipelineId, name]);
    }

    getJobsByPipeline (pipelineId: string): JobRow[] {
        return this.getAll<JobRow>("SELECT * FROM jobs WHERE pipeline_id = ? ORDER BY created_at ASC", [pipelineId]);
    }

    // ==================== Log Operations ====================

    appendLog (jobId: string, line: Omit<LogRow, "id" | "job_id">): void {
        const log: LogRow = {
            id: 0,
            job_id: jobId,
            ...line,
        };

        if (!this.logBuffer.has(jobId)) {
            this.logBuffer.set(jobId, []);
        }
        this.logBuffer.get(jobId)!.push(log);

        if (this.logBuffer.get(jobId)!.length >= this.LOG_BUFFER_SIZE) {
            this.flushJobLogs(jobId);
        } else {
            this.scheduleFlush();
        }
    }

    private scheduleFlush () {
        if (this.logBufferTimeout) return;

        this.logBufferTimeout = setTimeout(() => {
            this.flushLogs();
            this.logBufferTimeout = null;
        }, this.LOG_BUFFER_TIMEOUT_MS);
    }

    private flushJobLogs (jobId: string) {
        if (!this.db) return;
        const logs = this.logBuffer.get(jobId);
        if (!logs || logs.length === 0) return;

        for (const log of logs) {
            this.db.run(`
                INSERT INTO job_logs (job_id, line_number, stream, content, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `, [log.job_id, log.line_number, log.stream, log.content, log.timestamp]);
        }

        this.logBuffer.delete(jobId);
        this.scheduleSave();
    }

    flushLogs () {
        for (const jobId of this.logBuffer.keys()) {
            this.flushJobLogs(jobId);
        }
    }

    getJobLogs (jobId: string, offset: number = 0, limit: number = 1000): LogRow[] {
        this.flushJobLogs(jobId);
        return this.getAll<LogRow>(`
            SELECT * FROM job_logs
            WHERE job_id = ?
            ORDER BY line_number ASC
            LIMIT ? OFFSET ?
        `, [jobId, limit, offset]);
    }

    getJobLogCount (jobId: string): number {
        this.flushJobLogs(jobId);
        const result = this.getOne<{count: number}>("SELECT COUNT(*) as count FROM job_logs WHERE job_id = ?", [jobId]);
        return result?.count ?? 0;
    }

    // ==================== Artifact Operations ====================

    recordArtifact (artifact: Omit<ArtifactRow, "id" | "created_at"> & {created_at?: number}): ArtifactRow {
        if (!this.db) throw new Error("Database not initialized");

        const row = {
            ...artifact,
            created_at: artifact.created_at ?? Date.now(),
        };

        this.db.run(`
            INSERT INTO artifacts (job_id, file_path, size, created_at)
            VALUES (?, ?, ?, ?)
        `, [row.job_id, row.file_path, row.size, row.created_at]);

        // Get the last inserted ID
        const result = this.getOne<{id: number}>("SELECT last_insert_rowid() as id", []);
        this.scheduleSave();
        return {id: result?.id ?? 0, ...row} as ArtifactRow;
    }

    getArtifactsByJob (jobId: string): ArtifactRow[] {
        return this.getAll<ArtifactRow>("SELECT * FROM artifacts WHERE job_id = ? ORDER BY file_path ASC", [jobId]);
    }

    // ==================== Utility Operations ====================

    // Mark any incomplete pipelines/jobs as cancelled (for cleanup on startup)
    markIncompleteAsCancelled (): {pipelines: number; jobs: number} {
        if (!this.db) return {pipelines: 0, jobs: 0};

        const now = Date.now();

        // Mark running/pending/queued pipelines as cancelled
        this.db.run(`
            UPDATE pipelines
            SET status = 'canceled', finished_at = ?
            WHERE status IN ('running', 'pending', 'queued')
        `, [now]);
        const pipelineResult = this.getOne<{count: number}>(`
            SELECT changes() as count
        `, []);
        const pipelinesUpdated = pipelineResult?.count ?? 0;

        // Mark running/pending jobs as cancelled
        this.db.run(`
            UPDATE jobs
            SET status = 'canceled', finished_at = ?
            WHERE status IN ('running', 'pending')
        `, [now]);
        const jobResult = this.getOne<{count: number}>(`
            SELECT changes() as count
        `, []);
        const jobsUpdated = jobResult?.count ?? 0;

        if (pipelinesUpdated > 0 || jobsUpdated > 0) {
            this.save();
        }

        return {pipelines: pipelinesUpdated, jobs: jobsUpdated};
    }

    getStats () {
        const pipelineCount = this.getOne<{count: number}>("SELECT COUNT(*) as count FROM pipelines", []);
        const jobCount = this.getOne<{count: number}>("SELECT COUNT(*) as count FROM jobs", []);
        const logCount = this.getOne<{count: number}>("SELECT COUNT(*) as count FROM job_logs", []);
        const artifactCount = this.getOne<{count: number}>("SELECT COUNT(*) as count FROM artifacts", []);

        return {
            pipelines: pipelineCount?.count ?? 0,
            jobs: jobCount?.count ?? 0,
            logs: logCount?.count ?? 0,
            artifacts: artifactCount?.count ?? 0,
        };
    }

    vacuum () {
        if (!this.db) return;
        this.flushLogs();
        this.db.run("VACUUM");
        this.save();
    }
}

// Reset the cached SQL.js constructor (useful for testing)
export function resetSqlJsCache () {
    cachedSQL = null;
}
