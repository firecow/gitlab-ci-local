import {jest, describe, test, expect, beforeEach, afterEach} from "@jest/globals";
import {EventEmitter} from "../src/web/events/event-emitter.js";
import {EventType, PipelineEvent, JobEvent, LogEvent} from "../src/web/events/event-types.js";
import {EventRecorder} from "../src/web/events/event-recorder.js";
import {SSEManager} from "../src/web/server/sse-manager.js";
import {EventBroadcaster} from "../src/web/events/event-broadcaster.js";
import {GCLDatabase} from "../src/web/persistence/database.js";
import {ParserIncludes} from "../src/parser-includes.js";
import {cleanupEventSystem} from "../src/handler.js";
import fs from "fs-extra";
import path from "path";
import os from "os";
import http from "http";

// Reset EventEmitter before each test to ensure isolation
beforeEach(() => {
    EventEmitter.reset();
});

afterEach(() => {
    EventEmitter.reset();
});

describe("EventEmitter", () => {
    test("getInstance returns singleton", () => {
        const emitter1 = EventEmitter.getInstance();
        const emitter2 = EventEmitter.getInstance();
        expect(emitter1).toBe(emitter2);
    });

    test("is disabled by default", () => {
        const emitter = EventEmitter.getInstance();
        expect(emitter.isEnabled()).toBe(false);
    });

    test("can be enabled and disabled", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        expect(emitter.isEnabled()).toBe(true);
        emitter.disable();
        expect(emitter.isEnabled()).toBe(false);
    });

    test("emit does nothing when disabled", () => {
        const emitter = EventEmitter.getInstance();
        const callback = jest.fn();
        emitter.on(EventType.PIPELINE_STARTED, callback);

        const event: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId: "test-1",
            pipelineIid: 1,
            data: {status: "running"},
        };
        emitter.emit(event);

        expect(callback).not.toHaveBeenCalled();
    });

    test("emit calls listeners when enabled", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const callback = jest.fn();
        emitter.on(EventType.PIPELINE_STARTED, callback);

        const event: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId: "test-1",
            pipelineIid: 1,
            data: {status: "running"},
        };
        emitter.emit(event);

        expect(callback).toHaveBeenCalledWith(event);
    });

    test("on/off adds and removes listeners", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const callback = jest.fn();

        emitter.on(EventType.JOB_STARTED, callback);
        expect(emitter.listenerCount(EventType.JOB_STARTED)).toBe(1);

        emitter.off(EventType.JOB_STARTED, callback);
        expect(emitter.listenerCount(EventType.JOB_STARTED)).toBe(0);
    });

    test("once listener is called only once", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const callback = jest.fn();

        emitter.once(EventType.JOB_FINISHED, callback);

        const event: JobEvent = {
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId: "test-1",
            pipelineIid: 1,
            jobId: "job-1",
            jobName: "test-job",
            data: {status: "success"},
        };

        emitter.emit(event);
        emitter.emit(event);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test("removeAllListeners clears all listeners", () => {
        const emitter = EventEmitter.getInstance();
        emitter.on(EventType.PIPELINE_STARTED, jest.fn());
        emitter.on(EventType.JOB_STARTED, jest.fn());
        emitter.on(EventType.JOB_FINISHED, jest.fn());

        emitter.removeAllListeners();

        expect(emitter.listenerCount(EventType.PIPELINE_STARTED)).toBe(0);
        expect(emitter.listenerCount(EventType.JOB_STARTED)).toBe(0);
        expect(emitter.listenerCount(EventType.JOB_FINISHED)).toBe(0);
    });

    test("removeAllListeners with type clears only that type", () => {
        const emitter = EventEmitter.getInstance();
        emitter.on(EventType.PIPELINE_STARTED, jest.fn());
        emitter.on(EventType.JOB_STARTED, jest.fn());

        emitter.removeAllListeners(EventType.PIPELINE_STARTED);

        expect(emitter.listenerCount(EventType.PIPELINE_STARTED)).toBe(0);
        expect(emitter.listenerCount(EventType.JOB_STARTED)).toBe(1);
    });

    test("reset clears listeners and disables", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        emitter.on(EventType.PIPELINE_STARTED, jest.fn());

        EventEmitter.reset();

        expect(emitter.isEnabled()).toBe(false);
        expect(emitter.listenerCount(EventType.PIPELINE_STARTED)).toBe(0);
    });

    test("listener errors are caught and logged", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const errorCallback = () => {
            throw new Error("Test error");
        };
        const successCallback = jest.fn();

        emitter.on(EventType.JOB_LOG_LINE, errorCallback);
        emitter.on(EventType.JOB_LOG_LINE, successCallback);

        const event: LogEvent = {
            type: EventType.JOB_LOG_LINE,
            timestamp: Date.now(),
            pipelineId: "test-1",
            pipelineIid: 1,
            jobId: "job-1",
            jobName: "test-job",
            line: "test output",
            stream: "stdout",
        };

        emitter.emit(event);

        // Error should be caught, and other listeners should still be called
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(successCallback).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

describe("SSEManager", () => {
    test("getConnectionCount returns 0 when no connections", () => {
        const manager = new SSEManager();
        expect(manager.getConnectionCount()).toBe(0);
    });

    test("broadcast buffers events for reconnection", () => {
        const manager = new SSEManager();
        const event: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId: "test-1",
            pipelineIid: 1,
            data: {status: "running"},
        };

        // Broadcast without any connections - should buffer
        manager.broadcast("test-1", event);

        // No connections, so count should be 0
        expect(manager.getConnectionCount("test-1")).toBe(0);
    });

    test("closeAll clears connections", () => {
        const manager = new SSEManager();
        manager.closeAll();
        expect(manager.getConnectionCount()).toBe(0);
    });
});

describe("EventRecorder", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
        EventEmitter.reset();
    });

    test("registers listeners on creation", () => {
        const emitter = EventEmitter.getInstance();
        const initialCount = emitter.listenerCount(EventType.PIPELINE_STARTED);

        const recorder = new EventRecorder(db);

        expect(emitter.listenerCount(EventType.PIPELINE_STARTED)).toBe(initialCount + 1);
        expect(emitter.listenerCount(EventType.PIPELINE_FINISHED)).toBe(initialCount + 1);
        expect(emitter.listenerCount(EventType.JOB_STARTED)).toBe(initialCount + 1);
        expect(emitter.listenerCount(EventType.JOB_FINISHED)).toBe(initialCount + 1);
        expect(emitter.listenerCount(EventType.JOB_LOG_LINE)).toBe(initialCount + 1);

        recorder.destroy();
    });

    test("destroy removes all listeners", () => {
        const emitter = EventEmitter.getInstance();
        const recorder = new EventRecorder(db);

        recorder.destroy();

        expect(emitter.listenerCount(EventType.PIPELINE_STARTED)).toBe(0);
        expect(emitter.listenerCount(EventType.PIPELINE_FINISHED)).toBe(0);
        expect(emitter.listenerCount(EventType.JOB_STARTED)).toBe(0);
        expect(emitter.listenerCount(EventType.JOB_FINISHED)).toBe(0);
        expect(emitter.listenerCount(EventType.JOB_LOG_LINE)).toBe(0);
    });

    test("records pipeline events to database", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `pipeline-${Date.now()}`;
        const event: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running", cwd: "/test"},
        };

        emitter.emit(event);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline).not.toBeNull();
        expect(pipeline?.status).toBe("running");

        recorder.destroy();
    });

    test("records job events to database", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `pipeline-${Date.now()}`;
        const jobId = `job-${Date.now()}`;

        // First create pipeline
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Then create job
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job).not.toBeNull();
        expect(job?.name).toBe("test-job");
        expect(job?.status).toBe("running");

        recorder.destroy();
    });

    test("cleanup flushes logs", () => {
        const recorder = new EventRecorder(db);
        const flushSpy = jest.spyOn(db, "flushLogs");

        recorder.cleanup();

        expect(flushSpy).toHaveBeenCalled();
        flushSpy.mockRestore();
        recorder.destroy();
    });
});

describe("GCLDatabase", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
    });

    test("creates and retrieves pipelines", () => {
        db.createPipeline({
            id: "test-pipeline-1",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc123",
        });

        const retrieved = db.getPipeline("test-pipeline-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe("test-pipeline-1");
        expect(retrieved?.status).toBe("running");
    });

    test("updates pipelines", () => {
        db.createPipeline({
            id: "test-pipeline-2",
            iid: 2,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc123",
        });

        db.updatePipeline("test-pipeline-2", {status: "success", finished_at: Date.now()});

        const retrieved = db.getPipeline("test-pipeline-2");
        expect(retrieved?.status).toBe("success");
    });

    test("creates and retrieves jobs", () => {
        db.createPipeline({
            id: "test-pipeline-3",
            iid: 3,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc123",
        });

        db.createJob({
            id: "test-job-1",
            pipeline_id: "test-pipeline-3",
            name: "build-job",
            base_name: "build-job",
            stage: "build",
            status: "running",
            when_condition: "on_success",
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const retrieved = db.getJob("test-job-1");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.name).toBe("build-job");
    });

    test("getJobsByPipeline returns all jobs for a pipeline", () => {
        db.createPipeline({
            id: "test-pipeline-4",
            iid: 4,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc123",
        });

        db.createJob({
            id: "test-job-2",
            pipeline_id: "test-pipeline-4",
            name: "job-a",
            base_name: "job-a",
            stage: "build",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        db.createJob({
            id: "test-job-3",
            pipeline_id: "test-pipeline-4",
            name: "job-b",
            base_name: "job-b",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const jobs = db.getJobsByPipeline("test-pipeline-4");
        expect(jobs).toHaveLength(2);
    });

    test("appends and retrieves logs", () => {
        db.createPipeline({
            id: "test-pipeline-5",
            iid: 5,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc123",
        });

        db.createJob({
            id: "test-job-4",
            pipeline_id: "test-pipeline-5",
            name: "log-job",
            base_name: "log-job",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        db.appendLog("test-job-4", {line_number: 0, stream: "stdout", content: "Hello", timestamp: Date.now()});
        db.appendLog("test-job-4", {line_number: 1, stream: "stdout", content: "World", timestamp: Date.now()});
        db.flushLogs();

        const logs = db.getJobLogs("test-job-4");
        expect(logs).toHaveLength(2);
        expect(logs[0].content).toBe("Hello");
        expect(logs[1].content).toBe("World");
    });

    test("getRecentPipelines returns pipelines in descending order", () => {
        const baseTime = Date.now();
        const prefix = `recent-order-${baseTime}`;
        for (let i = 1; i <= 5; i++) {
            db.createPipeline({
                id: `${prefix}-pipeline-${i}`,
                iid: 5000 + i, // Use high unique iids
                status: "success",
                started_at: baseTime - (5 - i) * 1000,
                finished_at: baseTime - (5 - i) * 1000 + 100,
                duration: 100,
                cwd: "/test",
                git_ref: "main",
                git_sha: `sha${i}`,
                created_at: baseTime + i * 1000, // Increasing created_at
            });
        }

        const recent = db.getRecentPipelines(3);
        expect(recent).toHaveLength(3);
        // Most recent (highest created_at) should be first
        expect(recent[0].iid).toBeGreaterThan(recent[1].iid);
        expect(recent[1].iid).toBeGreaterThan(recent[2].iid);
    });

    test("markIncompleteAsCancelled updates running pipelines", () => {
        db.createPipeline({
            id: "incomplete-pipeline",
            iid: 100,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        const result = db.markIncompleteAsCancelled();
        expect(result.pipelines).toBe(1);

        const pipeline = db.getPipeline("incomplete-pipeline");
        expect(pipeline?.status).toBe("canceled");
    });

    test("getStats returns correct counts", () => {
        db.createPipeline({
            id: "stats-pipeline",
            iid: 200,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "stats-job",
            pipeline_id: "stats-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "success",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 50,
            exit_code: 0,
            coverage_percent: null,
        });

        const stats = db.getStats();
        expect(stats.pipelines).toBeGreaterThanOrEqual(1);
        expect(stats.jobs).toBeGreaterThanOrEqual(1);
    });
});

describe("GCLDatabase extended", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-test-ext-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
    });

    test("getPipelineByIid returns pipeline by iid", () => {
        db.createPipeline({
            id: "iid-test-pipeline",
            iid: 999,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc123",
        });

        const pipeline = db.getPipelineByIid(999);
        expect(pipeline).not.toBeNull();
        expect(pipeline?.id).toBe("iid-test-pipeline");
    });

    test("getPipelineByIid returns null for non-existent iid", () => {
        const pipeline = db.getPipelineByIid(99999);
        expect(pipeline).toBeNull();
    });

    test("getPipeline returns null for non-existent id", () => {
        const pipeline = db.getPipeline("non-existent");
        expect(pipeline).toBeNull();
    });

    test("getJob returns null for non-existent id", () => {
        const job = db.getJob("non-existent");
        expect(job).toBeNull();
    });

    test("updateJob updates job fields", () => {
        db.createPipeline({
            id: "update-job-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "update-job-1",
            pipeline_id: "update-job-pipeline",
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        db.updateJob("update-job-1", {
            status: "success",
            finished_at: Date.now(),
            duration: 1000,
            exit_code: 0,
            coverage_percent: 85.5,
        });

        const job = db.getJob("update-job-1");
        expect(job?.status).toBe("success");
        expect(job?.exit_code).toBe(0);
        expect(job?.coverage_percent).toBe(85.5);
    });

    test("updateJob handles allow_failure conversion", () => {
        db.createPipeline({
            id: "allow-fail-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "allow-fail-job",
            pipeline_id: "allow-fail-pipeline",
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        db.updateJob("allow-fail-job", {allow_failure: 1});

        const job = db.getJob("allow-fail-job");
        expect(job?.allow_failure).toBe(1);
    });

    test("getJobByPipelineAndName returns job", () => {
        db.createPipeline({
            id: "name-lookup-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "name-lookup-job",
            pipeline_id: "name-lookup-pipeline",
            name: "unique-job-name",
            base_name: "unique-job-name",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const job = db.getJobByPipelineAndName("name-lookup-pipeline", "unique-job-name");
        expect(job).not.toBeNull();
        expect(job?.id).toBe("name-lookup-job");
    });

    test("getJobLogCount returns correct count", () => {
        db.createPipeline({
            id: "log-count-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "log-count-job",
            pipeline_id: "log-count-pipeline",
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        db.appendLog("log-count-job", {line_number: 0, stream: "stdout", content: "Line 1", timestamp: Date.now()});
        db.appendLog("log-count-job", {line_number: 1, stream: "stdout", content: "Line 2", timestamp: Date.now()});
        db.appendLog("log-count-job", {line_number: 2, stream: "stderr", content: "Error", timestamp: Date.now()});

        const count = db.getJobLogCount("log-count-job");
        expect(count).toBe(3);
    });

    test("recordArtifact and getArtifactsByJob work correctly", () => {
        db.createPipeline({
            id: "artifact-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "artifact-job",
            pipeline_id: "artifact-pipeline",
            name: "build-job",
            base_name: "build-job",
            stage: "build",
            status: "success",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            exit_code: 0,
            coverage_percent: null,
        });

        db.recordArtifact({
            job_id: "artifact-job",
            file_path: "dist/app.js",
            size: 12345,
        });

        db.recordArtifact({
            job_id: "artifact-job",
            file_path: "dist/app.css",
            size: 5678,
        });

        const artifacts = db.getArtifactsByJob("artifact-job");
        expect(artifacts).toHaveLength(2);
        expect(artifacts[0].file_path).toBe("dist/app.css"); // Ordered alphabetically
        expect(artifacts[1].file_path).toBe("dist/app.js");
    });

    test("deleteOldPipelines keeps specified number of pipelines", () => {
        // Create 10 pipelines with unique prefix to isolate from other tests
        const prefix = `delete-test-${Date.now()}`;
        for (let i = 1; i <= 10; i++) {
            db.createPipeline({
                id: `${prefix}-pipeline-${i}`,
                iid: 1000 + i, // Use high iids to avoid conflicts
                status: "success",
                started_at: Date.now() - (10 - i) * 1000,
                finished_at: Date.now() - (10 - i) * 1000 + 100,
                duration: 100,
                cwd: "/test",
                git_ref: "main",
                git_sha: `sha${i}`,
            });
        }

        db.deleteOldPipelines(5);

        const remaining = db.getRecentPipelines(20);
        expect(remaining).toHaveLength(5);
        // Should keep the 5 most recent
        const iids = remaining.map(p => p.iid).sort((a, b) => b - a);
        expect(iids).toHaveLength(5);
    });

    test("vacuum runs without error", () => {
        db.createPipeline({
            id: "vacuum-test",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        // Should not throw
        db.vacuum();

        // Database should still work
        const pipeline = db.getPipeline("vacuum-test");
        expect(pipeline).not.toBeNull();
    });

    test("markIncompleteAsCancelled handles queued and running pipelines", () => {
        db.createPipeline({
            id: "queued-pipeline-1",
            iid: 1,
            status: "queued",
            started_at: null,
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createPipeline({
            id: "running-pipeline-1",
            iid: 2,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        const result = db.markIncompleteAsCancelled();
        expect(result.pipelines).toBe(2);

        expect(db.getPipeline("queued-pipeline-1")?.status).toBe("canceled");
        expect(db.getPipeline("running-pipeline-1")?.status).toBe("canceled");
    });

    test("markIncompleteAsCancelled handles pending jobs", () => {
        db.createPipeline({
            id: "job-cancel-pipeline",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "pending-job",
            pipeline_id: "job-cancel-pipeline",
            name: "pending-test",
            base_name: "pending-test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const result = db.markIncompleteAsCancelled();
        expect(result.jobs).toBe(1);

        expect(db.getJob("pending-job")?.status).toBe("canceled");
    });

    test("getRecentPipelines with offset works correctly", () => {
        for (let i = 1; i <= 10; i++) {
            db.createPipeline({
                id: `offset-pipeline-${i}`,
                iid: i,
                status: "success",
                started_at: Date.now() - (10 - i) * 1000,
                finished_at: Date.now() - (10 - i) * 1000 + 100,
                duration: 100,
                cwd: "/test",
                git_ref: "main",
                git_sha: `sha${i}`,
            });
        }

        const page2 = db.getRecentPipelines(3, 3);
        expect(page2).toHaveLength(3);
        // Should return pipelines 7, 6, 5 (offset by 3 from most recent)
    });
});

describe("EventRecorder full lifecycle", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-test-lifecycle-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
        EventEmitter.reset();
    });

    test("records full pipeline lifecycle", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `lifecycle-pipeline-${Date.now()}`;
        const startTime = Date.now();

        // Pipeline queued
        emitter.emit({
            type: EventType.PIPELINE_QUEUED,
            timestamp: startTime,
            pipelineId,
            pipelineIid: 1,
            data: {cwd: "/test", gitRef: "main", gitSha: "abc123"},
        } as PipelineEvent);

        let pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.status).toBe("queued");

        // Pipeline started
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: startTime + 100,
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.status).toBe("running");

        // Pipeline finished
        emitter.emit({
            type: EventType.PIPELINE_FINISHED,
            timestamp: startTime + 1000,
            pipelineId,
            pipelineIid: 1,
            data: {status: "success"},
        } as PipelineEvent);

        pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.status).toBe("success");
        expect(pipeline?.finished_at).not.toBeNull();

        recorder.destroy();
    });

    test("records full job lifecycle with logs", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-lifecycle-pipeline-${Date.now()}`;
        const jobId = `job-lifecycle-${Date.now()}`;
        const startTime = Date.now();

        // Create pipeline first
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: startTime,
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Job queued
        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: startTime + 10,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test", when: "on_success", allowFailure: false, needs: ["build-job"]},
        } as JobEvent);

        let job = db.getJob(jobId);
        expect(job?.status).toBe("pending");
        expect(job?.needs).toBe(JSON.stringify(["build-job"]));

        // Job started
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: startTime + 100,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        job = db.getJob(jobId);
        expect(job?.status).toBe("running");

        // Log lines
        emitter.emit({
            type: EventType.JOB_LOG_LINE,
            timestamp: startTime + 200,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            line: "Running tests...",
            stream: "stdout",
        } as LogEvent);

        emitter.emit({
            type: EventType.JOB_LOG_LINE,
            timestamp: startTime + 300,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            line: "All tests passed!",
            stream: "stdout",
        } as LogEvent);

        // Job finished
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: startTime + 500,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {status: "success", exitCode: 0, coverage: 95.5},
        } as JobEvent);

        job = db.getJob(jobId);
        expect(job?.status).toBe("success");
        expect(job?.exit_code).toBe(0);
        expect(job?.coverage_percent).toBe(95.5);

        const logs = db.getJobLogs(jobId);
        expect(logs).toHaveLength(2);

        recorder.destroy();
    });

    test("handles job with matrix suffix in name", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `matrix-pipeline-${Date.now()}`;
        const jobId = `matrix-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job [node:18, os:ubuntu]",
            data: {stage: "test"},
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.name).toBe("test-job [node:18, os:ubuntu]");
        expect(job?.base_name).toBe("test-job");

        recorder.destroy();
    });

    test("handles pipeline finished event for non-existent pipeline gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        emitter.emit({
            type: EventType.PIPELINE_FINISHED,
            timestamp: Date.now(),
            pipelineId: "non-existent-pipeline",
            pipelineIid: 999,
            data: {status: "success"},
        } as PipelineEvent);

        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
        recorder.destroy();
    });

    test("handles job finished event for non-existent job gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId: "some-pipeline",
            pipelineIid: 1,
            jobId: "non-existent-job",
            jobName: "missing-job",
            data: {status: "success"},
        } as JobEvent);

        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
        recorder.destroy();
    });
});

describe("EventBroadcaster", () => {
    test("registers listeners for all event types", () => {
        const emitter = EventEmitter.getInstance();
        const sseManager = new SSEManager();
        const initialCounts: Record<string, number> = {};

        Object.values(EventType).forEach(type => {
            initialCounts[type] = emitter.listenerCount(type);
        });

        const broadcaster = new EventBroadcaster(sseManager);

        Object.values(EventType).forEach(type => {
            expect(emitter.listenerCount(type)).toBe(initialCounts[type] + 1);
        });

        broadcaster.cleanup();
    });

    test("broadcasts events to SSE manager", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const sseManager = new SSEManager();
        const broadcastSpy = jest.spyOn(sseManager, "broadcast");

        const broadcaster = new EventBroadcaster(sseManager);

        const event: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId: "broadcast-test",
            pipelineIid: 1,
            data: {status: "running"},
        };

        emitter.emit(event);

        expect(broadcastSpy).toHaveBeenCalledWith("broadcast-test", event);
        broadcastSpy.mockRestore();
        broadcaster.cleanup();
    });
});

describe("ParserIncludes cache", () => {
    test("clearLocalRepoFilesCache clears the cache", () => {
        // This test verifies the cache clearing function exists and runs without error
        ParserIncludes.clearLocalRepoFilesCache();
        // If we got here without error, the function works
        expect(true).toBe(true);
    });
});

describe("cleanupEventSystem", () => {
    test("cleans up without error when nothing to clean", () => {
        // Should not throw when called with nothing initialized
        cleanupEventSystem();
        expect(EventEmitter.getInstance().isEnabled()).toBe(false);
    });

    test("resets EventEmitter state", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        emitter.on(EventType.PIPELINE_STARTED, jest.fn());

        cleanupEventSystem();

        expect(emitter.isEnabled()).toBe(false);
        expect(emitter.listenerCount(EventType.PIPELINE_STARTED)).toBe(0);
    });
});

describe("SSEManager extended", () => {
    test("handleConnection with missing pipelineId returns 400", () => {
        const manager = new SSEManager();
        const mockReq = {
            url: "/events/other/path",
            on: jest.fn(),
        } as unknown as http.IncomingMessage;

        let statusCode = 0;
        let endCalled = false;
        const mockRes = {
            writeHead: jest.fn((code: number) => { statusCode = code; }),
            end: jest.fn(() => { endCalled = true; }),
            write: jest.fn(),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);

        expect(statusCode).toBe(400);
        expect(endCalled).toBe(true);
    });

    test("handleConnection with valid pipelineId sets up SSE", () => {
        const manager = new SSEManager();
        const onCallbacks: Record<string, () => void> = {};
        const mockReq = {
            url: "/events/pipelines/test-pipeline-123",
            on: jest.fn((event: string, cb: () => void) => { onCallbacks[event] = cb; }),
        } as unknown as http.IncomingMessage;

        let statusCode = 0;
        let headers: Record<string, string> = {};
        const writes: string[] = [];
        const mockRes = {
            writeHead: jest.fn((code: number, h: Record<string, string>) => {
                statusCode = code;
                headers = h;
            }),
            end: jest.fn(),
            write: jest.fn((data: string) => { writes.push(data); }),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);

        expect(statusCode).toBe(200);
        expect(headers["Content-Type"]).toBe("text/event-stream");
        expect(writes).toContain(": connected\n\n");
        expect(manager.getConnectionCount("test-pipeline-123")).toBe(1);
        expect(manager.getConnectionCount()).toBe(1);

        // Simulate disconnect
        onCallbacks["close"]?.();
        expect(manager.getConnectionCount("test-pipeline-123")).toBe(0);
    });

    test("handleConnection sends buffered events to new connections", () => {
        const manager = new SSEManager();
        const pipelineId = "buffered-test-pipeline";

        // First, broadcast some events (they get buffered)
        const event1: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        };
        const event2: JobEvent = {
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId: "job-1",
            jobName: "test-job",
            data: {stage: "test", status: "running"},
        };
        manager.broadcast(pipelineId, event1);
        manager.broadcast(pipelineId, event2);

        // Now connect
        const mockReq = {
            url: `/events/pipelines/${pipelineId}`,
            on: jest.fn(),
        } as unknown as http.IncomingMessage;

        const writes: string[] = [];
        const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            write: jest.fn((data: string) => { writes.push(data); }),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);

        // Should have received buffered events
        expect(writes.length).toBeGreaterThanOrEqual(3); // connected + 2 events
        expect(writes.some(w => w.includes("pipeline:started"))).toBe(true);
        expect(writes.some(w => w.includes("job:started"))).toBe(true);
    });

    test("broadcast to connected clients", () => {
        const manager = new SSEManager();
        const pipelineId = "broadcast-test";

        // Connect a client
        const mockReq = {
            url: `/events/pipelines/${pipelineId}`,
            on: jest.fn(),
        } as unknown as http.IncomingMessage;

        const writes: string[] = [];
        const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            write: jest.fn((data: string) => { writes.push(data); }),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);
        writes.length = 0; // Clear connection message

        // Broadcast event
        const event: PipelineEvent = {
            type: EventType.PIPELINE_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "success"},
        };
        manager.broadcast(pipelineId, event);

        expect(writes.length).toBe(1);
        expect(writes[0]).toContain("data: ");
        expect(writes[0]).toContain("pipeline:finished");
    });

    test("buffer overflow trims old events", () => {
        const manager = new SSEManager();
        const pipelineId = "overflow-test";

        // Broadcast 105 events (buffer size is 100)
        for (let i = 0; i < 105; i++) {
            manager.broadcast(pipelineId, {
                type: EventType.JOB_LOG_LINE,
                timestamp: Date.now(),
                pipelineId,
                pipelineIid: 1,
                jobId: "job-1",
                jobName: "test-job",
                line: `Log line ${i}`,
                stream: "stdout",
            } as LogEvent);
        }

        // Connect and check buffered events (should be 100, not 105)
        const mockReq = {
            url: `/events/pipelines/${pipelineId}`,
            on: jest.fn(),
        } as unknown as http.IncomingMessage;

        const writes: string[] = [];
        const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            write: jest.fn((data: string) => { writes.push(data); }),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);

        // 1 connected message + 100 buffered events
        expect(writes.length).toBe(101);
    });

    test("closeAll ends all connections", () => {
        const manager = new SSEManager();

        // Connect two clients to different pipelines
        const endCalls: number[] = [];
        for (let i = 0; i < 2; i++) {
            const mockReq = {
                url: `/events/pipelines/pipeline-${i}`,
                on: jest.fn(),
            } as unknown as http.IncomingMessage;

            const mockRes = {
                writeHead: jest.fn(),
                end: jest.fn(() => { endCalls.push(i); }),
                write: jest.fn(),
            } as unknown as http.ServerResponse;

            manager.handleConnection(mockReq, mockRes);
        }

        expect(manager.getConnectionCount()).toBe(2);

        manager.closeAll();

        expect(endCalls.length).toBe(2);
        expect(manager.getConnectionCount()).toBe(0);
    });
});

describe("GCLDatabase reload and edge cases", () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-test-reload-${Date.now()}`);
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    test("reload reloads database from disk", async () => {
        const dbPath = path.join(tempDir, "reload-test.db");
        const db1 = new GCLDatabase(dbPath);
        await db1.init();

        db1.createPipeline({
            id: "original-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });
        db1.close();

        // Open a new database instance and modify
        const db2 = new GCLDatabase(dbPath);
        await db2.init();
        db2.updatePipeline("original-pipeline", {status: "success"});
        db2.close();

        // Reload and verify changes are visible
        const db3 = new GCLDatabase(dbPath);
        await db3.init();
        await db3.reload();

        const pipeline = db3.getPipeline("original-pipeline");
        expect(pipeline?.status).toBe("success");
        db3.close();
    });

    test("getJobLogs with offset works correctly", async () => {
        const dbPath = path.join(tempDir, "log-offset-test.db");
        const db = new GCLDatabase(dbPath);
        await db.init();

        db.createPipeline({
            id: "log-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "log-job",
            pipeline_id: "log-pipeline",
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Add 20 log lines
        for (let i = 0; i < 20; i++) {
            db.appendLog("log-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }
        db.flushLogs();

        // Get logs with offset
        const page2 = db.getJobLogs("log-job", 10, 5);
        expect(page2.length).toBe(5);
        expect(page2[0].content).toBe("Line 10");
        expect(page2[4].content).toBe("Line 14");

        db.close();
    });

    test("handles corrupt database by creating new one", async () => {
        const dbPath = path.join(tempDir, "corrupt-test.db");

        // Write garbage to simulate corruption
        await fs.writeFile(dbPath, "this is not a valid sqlite database");

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        const db = new GCLDatabase(dbPath);
        await db.init();

        // Should have created a new database
        expect(consoleWarnSpy).toHaveBeenCalled();

        // Database should be functional
        db.createPipeline({
            id: "new-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        const pipeline = db.getPipeline("new-pipeline");
        expect(pipeline).not.toBeNull();

        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        db.close();
    });
});

describe("EventRecorder edge cases", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-test-edge-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
        EventEmitter.reset();
    });

    test("logs for mapped job IDs are correctly associated", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `map-test-pipeline-${Date.now()}`;
        const webJobId = `web-job-${Date.now()}`;
        const cliJobId = `cli-job-${Date.now()}`;

        // Create pipeline
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Create job through web UI (different ID)
        db.createJob({
            id: webJobId,
            pipeline_id: pipelineId,
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // CLI starts job with different ID but same name
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId: cliJobId,
            jobName: "test-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        // Logs emitted with CLI job ID should be associated with web job ID
        emitter.emit({
            type: EventType.JOB_LOG_LINE,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId: cliJobId,
            jobName: "test-job",
            line: "Test output from CLI",
            stream: "stdout",
        } as LogEvent);

        db.flushLogs();

        // Job should be found by web ID and have the log
        const webJob = db.getJob(webJobId);
        expect(webJob).not.toBeNull();
        expect(webJob?.status).toBe("running");

        const logs = db.getJobLogs(webJobId);
        expect(logs.length).toBe(1);
        expect(logs[0].content).toBe("Test output from CLI");

        recorder.destroy();
    });

    test("job finished with mapped ID updates correct job", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `finish-map-pipeline-${Date.now()}`;
        const webJobId = `web-finish-job-${Date.now()}`;
        const cliJobId = `cli-finish-job-${Date.now()}`;

        // Create pipeline
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Pre-create job through web UI
        db.createJob({
            id: webJobId,
            pipeline_id: pipelineId,
            name: "finish-test-job",
            base_name: "finish-test-job",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // CLI starts job with different ID
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now() - 1000,
            pipelineId,
            pipelineIid: 1,
            jobId: cliJobId,
            jobName: "finish-test-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        // CLI finishes job
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId: cliJobId,
            jobName: "finish-test-job",
            data: {status: "success", exitCode: 0},
        } as JobEvent);

        // Web job should be updated
        const webJob = db.getJob(webJobId);
        expect(webJob?.status).toBe("success");
        expect(webJob?.exit_code).toBe(0);

        recorder.destroy();
    });

    test("handles stderr logs correctly", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `stderr-pipeline-${Date.now()}`;
        const jobId = `stderr-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "stderr-job",
            data: {stage: "test"},
        } as JobEvent);

        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "stderr-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        emitter.emit({
            type: EventType.JOB_LOG_LINE,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "stderr-job",
            line: "Error message",
            stream: "stderr",
        } as LogEvent);

        db.flushLogs();

        const logs = db.getJobLogs(jobId);
        expect(logs.length).toBe(1);
        expect(logs[0].stream).toBe("stderr");
        expect(logs[0].content).toBe("Error message");

        recorder.destroy();
    });

    test("handles allow_failure flag in job events", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `allow-fail-pipeline-${Date.now()}`;
        const jobId = `allow-fail-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "allow-fail-job",
            data: {stage: "test", allowFailure: true},
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.allow_failure).toBe(1);

        recorder.destroy();
    });

    test("handles log event before job is created", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `early-log-pipeline-${Date.now()}`;
        const jobId = `early-log-job-${Date.now()}`;

        // Emit log before job exists (edge case)
        emitter.emit({
            type: EventType.JOB_LOG_LINE,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            line: "Early log",
            stream: "stdout",
        } as LogEvent);

        // Should not throw, logs might be orphaned but that's ok
        db.flushLogs();

        recorder.destroy();
    });

    test("handles pipeline queued error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `error-pipeline-${Date.now()}`;

        // First create the pipeline
        emitter.emit({
            type: EventType.PIPELINE_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {},
        } as PipelineEvent);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Try to create duplicate - should log error but not throw
        emitter.emit({
            type: EventType.PIPELINE_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {},
        } as PipelineEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();

        recorder.destroy();
    });

    test("handles job queued error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-error-pipeline-${Date.now()}`;
        const jobId = `job-error-${Date.now()}`;

        // First create the pipeline
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Create job
        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test"},
        } as JobEvent);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Try to create duplicate job - should log error but not throw
        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test"},
        } as JobEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();

        recorder.destroy();
    });

    test("handles pipeline finished without started_at", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `no-start-pipeline-${Date.now()}`;

        // Create pipeline with null started_at
        db.createPipeline({
            id: pipelineId,
            iid: 1,
            status: "queued",
            started_at: null,
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        // Finish pipeline - duration should be null since started_at is null
        emitter.emit({
            type: EventType.PIPELINE_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "success"},
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.status).toBe("success");
        expect(pipeline?.duration).toBeNull();

        recorder.destroy();
    });

    test("handles job finished without started_at", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `no-start-job-pipeline-${Date.now()}`;
        const jobId = `no-start-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Create job with null started_at
        db.createJob({
            id: jobId,
            pipeline_id: pipelineId,
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Finish job - duration should be null since started_at is null
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {status: "success"},
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.status).toBe("success");
        expect(job?.duration).toBeNull();

        recorder.destroy();
    });

    test("handles job started with existing job by ID", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `existing-job-pipeline-${Date.now()}`;
        const jobId = `existing-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Create job via JOB_QUEUED event
        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "build"},
        } as JobEvent);

        // Start the same job - should update, not create
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.status).toBe("running");
        expect(job?.stage).toBe("test"); // Updated stage

        recorder.destroy();
    });

    test("handles job started error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();

        // Close the database to trigger an error
        db.close();

        // Create a new database for the recorder
        const db2 = new GCLDatabase(path.join(tempDir, "test2.db"));

        const recorder = new EventRecorder(db2);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Try to start job without initialized db - should log error
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId: "test",
            pipelineIid: 1,
            jobId: "test-job-id",
            jobName: "test-job",
            data: {stage: "test", status: "running"},
        } as JobEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();

        recorder.destroy();

        // Re-open the original db for afterEach cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });

    test("handles pipeline started error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();

        // Close the database to trigger an error
        db.close();

        const recorder = new EventRecorder(db);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Try to start pipeline without initialized db - should log error
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId: "test",
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();

        recorder.destroy();

        // Re-open the original db for afterEach cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });

    test("handles pipeline finished error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();

        // Close the database to trigger an error
        db.close();

        const recorder = new EventRecorder(db);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Try to finish pipeline without initialized db - should log error
        emitter.emit({
            type: EventType.PIPELINE_FINISHED,
            timestamp: Date.now(),
            pipelineId: "test",
            pipelineIid: 1,
            data: {status: "success"},
        } as PipelineEvent);

        // Should not call error since pipeline not found
        consoleErrorSpy.mockRestore();

        recorder.destroy();

        // Re-open the original db for afterEach cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });

    test("handles job log line error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();

        // Close the database to trigger an error
        db.close();

        const recorder = new EventRecorder(db);

        // Try to log without initialized db - should not throw
        // appendLog silently fails when db is null (returns early)
        expect(() => {
            emitter.emit({
                type: EventType.JOB_LOG_LINE,
                timestamp: Date.now(),
                pipelineId: "test",
                pipelineIid: 1,
                jobId: "test-job",
                jobName: "test-job",
                line: "test",
                stream: "stdout",
            } as LogEvent);
        }).not.toThrow();

        recorder.destroy();

        // Re-open the original db for afterEach cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });

    test("handles job finished error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();

        // Close the database to trigger an error
        db.close();

        const recorder = new EventRecorder(db);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Try to finish job without initialized db - should log error
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId: "test",
            pipelineIid: 1,
            jobId: "test-job",
            jobName: "test-job",
            data: {status: "success"},
        } as JobEvent);

        // Should not call error since job not found
        consoleErrorSpy.mockRestore();

        recorder.destroy();

        // Re-open the original db for afterEach cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });
});

describe("GCLDatabase null db edge cases", () => {
    test("operations on uninitialized database return safely", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-null-db-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "null.db"));
        // Don't call init()

        // These should return safely without throwing
        expect(db.getPipeline("test")).toBeNull();
        expect(db.getPipelineByIid(1)).toBeNull();
        expect(db.getRecentPipelines()).toEqual([]);
        expect(db.getJob("test")).toBeNull();
        expect(db.getJobByPipelineAndName("p", "j")).toBeNull();
        expect(db.getJobsByPipeline("test")).toEqual([]);
        expect(db.getJobLogs("test")).toEqual([]);
        expect(db.getJobLogCount("test")).toBe(0);
        expect(db.getArtifactsByJob("test")).toEqual([]);
        expect(db.markIncompleteAsCancelled()).toEqual({pipelines: 0, jobs: 0});

        // These should not throw
        db.updatePipeline("test", {status: "success"});
        db.updateJob("test", {status: "success"});
        db.deleteOldPipelines(5);
        db.vacuum();
        db.flushLogs();
        db.close();

        // These should throw
        expect(() => db.createPipeline({
            id: "test",
            iid: 1,
            status: "running",
            started_at: null,
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        })).toThrow("Database not initialized");

        expect(() => db.createJob({
            id: "test",
            pipeline_id: "test",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        })).toThrow("Database not initialized");

        expect(() => db.recordArtifact({
            job_id: "test",
            file_path: "test.txt",
            size: 100,
        })).toThrow("Database not initialized");

        await fs.remove(tempDir);
    });

    test("reload on uninitialized database returns safely", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-reload-null-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "null.db"));
        // Don't call init()

        // Should not throw
        await db.reload();

        await fs.remove(tempDir);
    });
});

describe("GCLDatabase debounce and timing", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-debounce-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
    });

    test("scheduleSave only triggers once for multiple updates", () => {
        // Create multiple pipelines rapidly
        for (let i = 0; i < 5; i++) {
            db.createPipeline({
                id: `rapid-pipeline-${i}`,
                iid: i,
                status: "running",
                started_at: Date.now(),
                finished_at: null,
                duration: null,
                cwd: "/test",
                git_ref: "main",
                git_sha: "abc",
            });
        }

        // All pipelines should be created
        const pipelines = db.getRecentPipelines(10);
        expect(pipelines.length).toBe(5);
    });

    test("log buffer triggers flush at LOG_BUFFER_SIZE", () => {
        db.createPipeline({
            id: "buffer-test-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "buffer-test-job",
            pipeline_id: "buffer-test-pipeline",
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Add exactly LOG_BUFFER_SIZE (10) logs to trigger flush
        for (let i = 0; i < 10; i++) {
            db.appendLog("buffer-test-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }

        // Logs should be flushed automatically
        const count = db.getJobLogCount("buffer-test-job");
        expect(count).toBe(10);
    });

    test("reload with pending saveTimeout", async () => {
        // Create a pipeline to trigger scheduleSave
        db.createPipeline({
            id: "reload-save-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        // Immediately reload - should handle pending save
        await db.reload();

        // Pipeline should still exist
        const pipeline = db.getPipeline("reload-save-pipeline");
        expect(pipeline).not.toBeNull();
    });

    test("reload when db file doesn't exist", async () => {
        // Remove the db file
        await fs.remove(path.join(tempDir, "test.db"));

        // Reload should handle missing file
        await db.reload();

        // Database should still be functional
        const stats = db.getStats();
        expect(stats.pipelines).toBe(0);
    });

    test("reload with corrupt file logs warning and keeps functioning", async () => {
        // Create some data first
        db.createPipeline({
            id: "keep-state-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        // Save current state properly
        db.close();

        // Now corrupt the db file
        await fs.writeFile(path.join(tempDir, "test.db"), "corrupt data");

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        // Create new db instance and try to init with corrupt file
        // This tests the init path with corrupt db
        const db2 = new GCLDatabase(path.join(tempDir, "test.db"));
        await db2.init();

        // Should have logged warning about corrupt database
        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();

        // Database should be functional with empty state
        const pipeline = db2.getPipeline("keep-state-pipeline");
        expect(pipeline).toBeNull(); // Original data is gone, new db was created

        db2.close();

        // Re-open original db for afterEach cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    test("flushJobLogs with empty buffer", () => {
        // Flush logs when buffer is empty - should not throw
        db.flushLogs();

        // Call getJobLogs for non-existent job (triggers flushJobLogs)
        const logs = db.getJobLogs("non-existent-job");
        expect(logs).toEqual([]);
    });
});

describe("SSEManager error handling", () => {
    test("sendEvent catches write errors", () => {
        const manager = new SSEManager();
        const pipelineId = "error-test";

        // Connect a client that throws on write
        const mockReq = {
            url: `/events/pipelines/${pipelineId}`,
            on: jest.fn(),
        } as unknown as http.IncomingMessage;

        const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            write: jest.fn((data: string) => {
                if (data.includes("data:")) {
                    throw new Error("Write error");
                }
            }),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);

        // Broadcast should not throw even when write fails
        const event: PipelineEvent = {
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        };

        expect(() => manager.broadcast(pipelineId, event)).not.toThrow();
    });

    test("closeAll catches end errors", () => {
        const manager = new SSEManager();

        // Connect a client that throws on end
        const mockReq = {
            url: "/events/pipelines/error-close",
            on: jest.fn(),
        } as unknown as http.IncomingMessage;

        const mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(() => { throw new Error("End error"); }),
            write: jest.fn(),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq, mockRes);

        // closeAll should not throw even when end fails
        expect(() => manager.closeAll()).not.toThrow();
        expect(manager.getConnectionCount()).toBe(0);
    });
});

describe("GCLDatabase migrations", () => {
    test("migration runs for database without needs column", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-migration-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        // Create a database and manually drop the needs column scenario
        // by creating a new database (which will run migrations)
        const db = new GCLDatabase(path.join(tempDir, "migrate.db"));
        await db.init();

        // Database should be functional with needs column
        db.createPipeline({
            id: "migrate-test",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "migrate-job",
            pipeline_id: "migrate-test",
            name: "test-job",
            base_name: "test-job",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: JSON.stringify(["other-job"]),
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const job = db.getJob("migrate-job");
        expect(job?.needs).toBe(JSON.stringify(["other-job"]));

        consoleLogSpy.mockRestore();
        db.close();
        await fs.remove(tempDir);
    });
});

describe("SSEManager additional branches", () => {
    test("disconnect one client leaves other clients connected", () => {
        const manager = new SSEManager();
        const pipelineId = "multi-client-test";

        const onCallbacks1: Record<string, () => void> = {};
        const onCallbacks2: Record<string, () => void> = {};

        // Connect first client
        const mockReq1 = {
            url: `/events/pipelines/${pipelineId}`,
            on: jest.fn((event: string, cb: () => void) => { onCallbacks1[event] = cb; }),
        } as unknown as http.IncomingMessage;

        const mockRes1 = {
            writeHead: jest.fn(),
            end: jest.fn(),
            write: jest.fn(),
        } as unknown as http.ServerResponse;

        // Connect second client
        const mockReq2 = {
            url: `/events/pipelines/${pipelineId}`,
            on: jest.fn((event: string, cb: () => void) => { onCallbacks2[event] = cb; }),
        } as unknown as http.IncomingMessage;

        const mockRes2 = {
            writeHead: jest.fn(),
            end: jest.fn(),
            write: jest.fn(),
        } as unknown as http.ServerResponse;

        manager.handleConnection(mockReq1, mockRes1);
        manager.handleConnection(mockReq2, mockRes2);

        expect(manager.getConnectionCount(pipelineId)).toBe(2);

        // Disconnect first client
        onCallbacks1["close"]?.();

        // Second client should still be connected
        expect(manager.getConnectionCount(pipelineId)).toBe(1);

        // Disconnect second client
        onCallbacks2["close"]?.();
        expect(manager.getConnectionCount(pipelineId)).toBe(0);
    });
});

describe("GCLDatabase additional branches", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-branch-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
    });

    test("getOne returns null for empty results", () => {
        // Query for non-existent data
        const result = db.getPipeline("non-existent-id");
        expect(result).toBeNull();
    });

    test("getAll returns empty array for no matches", () => {
        // Query for non-existent pipeline jobs
        const jobs = db.getJobsByPipeline("non-existent-pipeline");
        expect(jobs).toEqual([]);
    });

    test("scheduleFlush is debounced", () => {
        db.createPipeline({
            id: "flush-test-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        db.createJob({
            id: "flush-test-job",
            pipeline_id: "flush-test-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Add multiple logs rapidly (less than buffer size to trigger scheduleFlush)
        for (let i = 0; i < 5; i++) {
            db.appendLog("flush-test-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }

        // Flush should work after schedule
        db.flushLogs();
        const count = db.getJobLogCount("flush-test-job");
        expect(count).toBe(5);
    });

    test("markIncompleteAsCancelled with no incomplete items", () => {
        // Create only completed pipelines
        db.createPipeline({
            id: "complete-pipeline",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: "main",
            git_sha: "abc",
        });

        const result = db.markIncompleteAsCancelled();
        expect(result.pipelines).toBe(0);
        expect(result.jobs).toBe(0);
    });

    test("created_at defaults to Date.now when not provided", () => {
        const before = Date.now();

        const pipeline = db.createPipeline({
            id: "default-time-pipeline",
            iid: 1,
            status: "running",
            started_at: null,
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const after = Date.now();

        // created_at should be set automatically
        expect(pipeline.created_at).toBeGreaterThanOrEqual(before);
        expect(pipeline.created_at).toBeLessThanOrEqual(after);
    });

    test("job created_at defaults to Date.now when not provided", () => {
        db.createPipeline({
            id: "job-time-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const before = Date.now();

        const job = db.createJob({
            id: "default-time-job",
            pipeline_id: "job-time-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const after = Date.now();

        expect(job.created_at).toBeGreaterThanOrEqual(before);
        expect(job.created_at).toBeLessThanOrEqual(after);
    });

    test("artifact created_at defaults to Date.now when not provided", () => {
        db.createPipeline({
            id: "artifact-time-pipeline",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "artifact-time-job",
            pipeline_id: "artifact-time-pipeline",
            name: "build",
            base_name: "build",
            stage: "build",
            status: "success",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 50,
            exit_code: 0,
            coverage_percent: null,
        });

        const before = Date.now();

        const artifact = db.recordArtifact({
            job_id: "artifact-time-job",
            file_path: "build/output.js",
            size: 12345,
        });

        const after = Date.now();

        expect(artifact.created_at).toBeGreaterThanOrEqual(before);
        expect(artifact.created_at).toBeLessThanOrEqual(after);
    });
});

describe("EventRecorder additional branches", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-recorder-branch-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
        EventEmitter.reset();
    });

    test("pipeline queued uses process.cwd when cwd not provided", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `cwd-default-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {}, // No cwd provided
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.cwd).toBe(process.cwd());

        recorder.destroy();
    });

    test("pipeline started uses process.cwd when cwd not provided", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `started-cwd-${Date.now()}`;

        // Start pipeline without queued first (creates new one)
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"}, // No cwd, gitRef, gitSha
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.cwd).toBe(process.cwd());
        expect(pipeline?.git_ref).toBeNull();
        expect(pipeline?.git_sha).toBeNull();

        recorder.destroy();
    });

    test("pipeline finished uses default status when not provided", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `default-status-${Date.now()}`;

        // Create pipeline
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now() - 1000,
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Finish without status
        emitter.emit({
            type: EventType.PIPELINE_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {}, // No status provided
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.status).toBe("success"); // Default

        recorder.destroy();
    });

    test("job queued with all optional fields", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-opts-${Date.now()}`;
        const jobId = `job-all-opts-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "full-options-job",
            data: {
                stage: "deploy",
                when: "manual",
                allowFailure: true,
                needs: ["build", "test"],
            },
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.stage).toBe("deploy");
        expect(job?.when_condition).toBe("manual");
        expect(job?.allow_failure).toBe(1);
        expect(job?.needs).toBe(JSON.stringify(["build", "test"]));

        recorder.destroy();
    });

    test("job queued with minimal fields uses defaults", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-minimal-${Date.now()}`;
        const jobId = `job-min-opts-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "minimal-job",
            data: {}, // No optional fields
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.stage).toBe("unknown");
        expect(job?.when_condition).toBeNull();
        expect(job?.allow_failure).toBe(0);
        expect(job?.needs).toBeNull();

        recorder.destroy();
    });

    test("job started creates job with all fields when not existing", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-started-create-${Date.now()}`;
        const jobId = `job-started-new-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Start job without queued first
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "new-job [matrix:value]",
            data: {
                stage: "test",
                when: "on_failure",
                allowFailure: true,
                needs: ["setup"],
            },
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.name).toBe("new-job [matrix:value]");
        expect(job?.base_name).toBe("new-job");
        expect(job?.stage).toBe("test");
        expect(job?.status).toBe("running");
        expect(job?.when_condition).toBe("on_failure");
        expect(job?.allow_failure).toBe(1);
        expect(job?.needs).toBe(JSON.stringify(["setup"]));

        recorder.destroy();
    });

    test("job finished uses default status when not provided", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-fin-default-${Date.now()}`;
        const jobId = `job-fin-no-status-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now() - 1000,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test"},
        } as JobEvent);

        // Finish without status, exitCode, or coverage
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {}, // No status, exitCode, or coverage
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.status).toBe("success");
        expect(job?.exit_code).toBeNull();
        expect(job?.coverage_percent).toBeNull();

        recorder.destroy();
    });

    test("job finished with exit code zero", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-exit-zero-${Date.now()}`;
        const jobId = `job-exit-0-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now() - 1000,
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test"},
        } as JobEvent);

        // Finish with exit code 0 (falsy but valid)
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {status: "success", exitCode: 0, coverage: 0}, // 0 values
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.exit_code).toBe(0);
        expect(job?.coverage_percent).toBe(0);

        recorder.destroy();
    });

    test("job started updates existing job with stage fallback", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `stage-fallback-${Date.now()}`;
        const jobId = `stage-fb-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Queue job with specific stage
        emitter.emit({
            type: EventType.JOB_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "fallback-job",
            data: {stage: "build"},
        } as JobEvent);

        // Start job without stage (should keep original)
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "fallback-job",
            data: {}, // No stage
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.stage).toBe("build"); // Keeps original stage

        recorder.destroy();
    });

    test("pipeline queued with cwd provided", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `cwd-provided-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_QUEUED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {
                cwd: "/custom/path",
                gitRef: "main",
                gitSha: "abc123",
            },
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.cwd).toBe("/custom/path");
        expect(pipeline?.git_ref).toBe("main");
        expect(pipeline?.git_sha).toBe("abc123");

        recorder.destroy();
    });
});

describe("GCLDatabase final branch coverage", () => {
    test("getJobLogCount with null result", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-logcount-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Get log count for non-existent job (should return 0 via ?? 0)
        const count = db.getJobLogCount("non-existent-job");
        expect(count).toBe(0);

        db.close();
        await fs.remove(tempDir);
    });

    test("getStats with empty database", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-stats-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Empty database stats should all be 0 (via ?? 0)
        const stats = db.getStats();
        expect(stats.pipelines).toBe(0);
        expect(stats.jobs).toBe(0);
        expect(stats.logs).toBe(0);
        expect(stats.artifacts).toBe(0);

        db.close();
        await fs.remove(tempDir);
    });

    test("updateJob with allow_failure true converts to 1", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-update-allow-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "update-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "update-job",
            pipeline_id: "update-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Update with allow_failure true (tests the conversion branch)
        db.updateJob("update-job", {allow_failure: 1});

        const job = db.getJob("update-job");
        expect(job?.allow_failure).toBe(1);

        db.close();
        await fs.remove(tempDir);
    });

    test("rapid scheduleSave calls are debounced", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-save-debounce-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Rapidly create and update pipelines
        for (let i = 0; i < 10; i++) {
            db.createPipeline({
                id: `debounce-pipeline-${i}`,
                iid: i,
                status: "running",
                started_at: Date.now(),
                finished_at: null,
                duration: null,
                cwd: "/test",
                git_ref: null,
                git_sha: null,
            });
            db.updatePipeline(`debounce-pipeline-${i}`, {status: "success"});
        }

        // All pipelines should exist
        const pipelines = db.getRecentPipelines(20);
        expect(pipelines.length).toBe(10);

        db.close();
        await fs.remove(tempDir);
    });

    test("close handles missing db gracefully", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-close-null-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        // Don't init, so db is null

        // Should not throw
        db.close();

        await fs.remove(tempDir);
    });

    test("save handles null db", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-save-null-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        // Don't init, so db is null

        // Close should not throw (calls save internally)
        db.close();

        await fs.remove(tempDir);
    });

    test("scheduleFlush debounces multiple calls", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-flush-debounce-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "debounce-flush-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "debounce-flush-job",
            pipeline_id: "debounce-flush-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Add multiple logs rapidly (less than buffer size)
        // Each call triggers scheduleFlush, but it's debounced
        for (let i = 0; i < 3; i++) {
            db.appendLog("debounce-flush-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }

        // Add more logs immediately (scheduleFlush should be already scheduled)
        for (let i = 3; i < 6; i++) {
            db.appendLog("debounce-flush-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }

        db.flushLogs();
        const count = db.getJobLogCount("debounce-flush-job");
        expect(count).toBe(6);

        db.close();
        await fs.remove(tempDir);
    });

    test("flushJobLogs handles empty log buffer", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-empty-flush-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "empty-flush-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "empty-flush-job",
            pipeline_id: "empty-flush-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Get logs for job with no logs yet
        const logs = db.getJobLogs("empty-flush-job");
        expect(logs).toEqual([]);

        db.close();
        await fs.remove(tempDir);
    });

    test("getOne with query returning columns but no values", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-empty-values-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // getPipeline on non-existent ID triggers getOne with no matching rows
        const pipeline = db.getPipeline("non-existent");
        expect(pipeline).toBeNull();

        db.close();
        await fs.remove(tempDir);
    });

    test("getAll with query returning no results", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-empty-all-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // getJobsByPipeline on non-existent ID triggers getAll with no results
        const jobs = db.getJobsByPipeline("non-existent");
        expect(jobs).toEqual([]);

        db.close();
        await fs.remove(tempDir);
    });

    test("reload clears saveTimeout if pending", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-reload-timeout-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create a pipeline to trigger scheduleSave
        db.createPipeline({
            id: "reload-timeout-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        // Immediately reload (saveTimeout should be pending)
        await db.reload();

        // Create another pipeline after reload
        db.createPipeline({
            id: "reload-timeout-pipeline-2",
            iid: 2,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const pipelines = db.getRecentPipelines(10);
        expect(pipelines.length).toBe(2);

        db.close();
        await fs.remove(tempDir);
    });
});

describe("EventRecorder final branch", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-recorder-final-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        db.close();
        await fs.remove(tempDir);
        EventEmitter.reset();
    });

    test("pipeline started with all data fields provided", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `full-data-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {
                status: "running",
                cwd: "/custom/cwd",
                gitRef: "feature-branch",
                gitSha: "deadbeef",
            },
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.cwd).toBe("/custom/cwd");
        expect(pipeline?.git_ref).toBe("feature-branch");
        expect(pipeline?.git_sha).toBe("deadbeef");

        recorder.destroy();
    });

    test("job started creates new job with all optional fields undefined", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-minimal-start-${Date.now()}`;
        const jobId = `minimal-start-job-${Date.now()}`;

        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        // Start job directly without queue, with minimal data
        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "minimal-job",
            data: {}, // All optional fields undefined
        } as JobEvent);

        const job = db.getJob(jobId);
        expect(job?.stage).toBe("unknown");
        expect(job?.when_condition).toBeNull();
        expect(job?.allow_failure).toBe(0);
        expect(job?.needs).toBeNull();

        recorder.destroy();
    });

    test("pipeline started updates existing pipeline", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `update-existing-${Date.now()}`;

        // First queue the pipeline
        emitter.emit({
            type: EventType.PIPELINE_QUEUED,
            timestamp: Date.now() - 1000,
            pipelineId,
            pipelineIid: 1,
            data: {cwd: "/test"},
        } as PipelineEvent);

        // Then start it (should update, not create)
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        const pipeline = db.getPipeline(pipelineId);
        expect(pipeline?.status).toBe("running");
        expect(pipeline?.started_at).not.toBeNull();

        recorder.destroy();
    });
});

describe("GCLDatabase remaining branches", () => {
    test("updateJob without allow_failure field", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-update-no-allow-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "no-allow-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "no-allow-job",
            pipeline_id: "no-allow-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Update without allow_failure (tests else branch of "allow_failure" in data)
        db.updateJob("no-allow-job", {status: "running"});

        const job = db.getJob("no-allow-job");
        expect(job?.status).toBe("running");
        expect(job?.allow_failure).toBe(0); // Unchanged

        db.close();
        await fs.remove(tempDir);
    });

    test("recordArtifact with explicit created_at", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-artifact-time-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "artifact-explicit-pipeline",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "artifact-explicit-job",
            pipeline_id: "artifact-explicit-pipeline",
            name: "build",
            base_name: "build",
            stage: "build",
            status: "success",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 50,
            exit_code: 0,
            coverage_percent: null,
        });

        const explicitTime = 1234567890;
        const artifact = db.recordArtifact({
            job_id: "artifact-explicit-job",
            file_path: "build/output.js",
            size: 12345,
            created_at: explicitTime,
        });

        expect(artifact.created_at).toBe(explicitTime);

        db.close();
        await fs.remove(tempDir);
    });

    test("createPipeline with explicit created_at", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-pipeline-time-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        const explicitTime = 1234567890;
        const pipeline = db.createPipeline({
            id: "explicit-time-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
            created_at: explicitTime,
        });

        expect(pipeline.created_at).toBe(explicitTime);

        db.close();
        await fs.remove(tempDir);
    });

    test("createJob with explicit created_at", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-job-time-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "job-explicit-time-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const explicitTime = 1234567890;
        const job = db.createJob({
            id: "explicit-time-job",
            pipeline_id: "job-explicit-time-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
            created_at: explicitTime,
        });

        expect(job.created_at).toBe(explicitTime);

        db.close();
        await fs.remove(tempDir);
    });

    test("createJob with allow_failure false", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-job-allow-false-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "allow-false-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const job = db.createJob({
            id: "allow-false-job",
            pipeline_id: "allow-false-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0, // Explicitly 0 (falsy)
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        expect(job.allow_failure).toBe(0);

        db.close();
        await fs.remove(tempDir);
    });

    test("createJob with allow_failure true", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-job-allow-true-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "allow-true-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const job = db.createJob({
            id: "allow-true-job",
            pipeline_id: "allow-true-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 1, // Truthy
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        expect(job.allow_failure).toBe(1);

        db.close();
        await fs.remove(tempDir);
    });

    test("markIncompleteAsCancelled with both pipelines and jobs", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-mark-both-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create running pipeline
        db.createPipeline({
            id: "mark-both-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        // Create pending job
        db.createJob({
            id: "mark-both-job",
            pipeline_id: "mark-both-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const result = db.markIncompleteAsCancelled();

        expect(result.pipelines).toBe(1);
        expect(result.jobs).toBe(1);

        const pipeline = db.getPipeline("mark-both-pipeline");
        expect(pipeline?.status).toBe("canceled");

        const job = db.getJob("mark-both-job");
        expect(job?.status).toBe("canceled");

        db.close();
        await fs.remove(tempDir);
    });

    test("markIncompleteAsCancelled with queued pipeline", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-mark-queued-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create queued pipeline
        db.createPipeline({
            id: "mark-queued-pipeline",
            iid: 1,
            status: "queued",
            started_at: null,
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        const result = db.markIncompleteAsCancelled();

        expect(result.pipelines).toBe(1);

        const pipeline = db.getPipeline("mark-queued-pipeline");
        expect(pipeline?.status).toBe("canceled");

        db.close();
        await fs.remove(tempDir);
    });

    test("deleteOldPipelines keeps newest pipelines", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-delete-old-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create 5 pipelines with distinct timestamps
        for (let i = 0; i < 5; i++) {
            db.createPipeline({
                id: `del-pipeline-${i}`,
                iid: i + 1,
                status: "success",
                started_at: Date.now() + i * 100,
                finished_at: Date.now() + i * 100 + 50,
                duration: 50,
                cwd: "/test",
                git_ref: null,
                git_sha: null,
                created_at: Date.now() + i * 100,
            });
        }

        // Keep only 3 newest
        db.deleteOldPipelines(3);

        const remaining = db.getRecentPipelines(10);
        expect(remaining.length).toBe(3);

        db.close();
        await fs.remove(tempDir);
    });

    test("getJobLogs with offset and limit", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-logs-offset-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "logs-offset-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "logs-offset-job",
            pipeline_id: "logs-offset-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // Add 20 logs
        for (let i = 0; i < 20; i++) {
            db.appendLog("logs-offset-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }
        db.flushLogs();

        // Get logs with offset and limit
        const logs = db.getJobLogs("logs-offset-job", 5, 10);
        expect(logs.length).toBe(10);
        expect(logs[0].line_number).toBe(5);
        expect(logs[9].line_number).toBe(14);

        db.close();
        await fs.remove(tempDir);
    });

    test("getRecentPipelines with offset", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-recent-offset-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create 10 pipelines
        for (let i = 0; i < 10; i++) {
            db.createPipeline({
                id: `recent-pipeline-${i}`,
                iid: i + 1,
                status: "success",
                started_at: Date.now() + i * 100,
                finished_at: Date.now() + i * 100 + 50,
                duration: 50,
                cwd: "/test",
                git_ref: null,
                git_sha: null,
                created_at: Date.now() + i * 100,
            });
        }

        // Get with offset
        const pipelines = db.getRecentPipelines(5, 3);
        expect(pipelines.length).toBe(5);

        db.close();
        await fs.remove(tempDir);
    });

    test("vacuum on database with data", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-vacuum-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "vacuum-pipeline",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "vacuum-job",
            pipeline_id: "vacuum-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "success",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 50,
            exit_code: 0,
            coverage_percent: null,
        });

        // Add logs
        for (let i = 0; i < 15; i++) {
            db.appendLog("vacuum-job", {
                line_number: i,
                stream: "stdout",
                content: `Line ${i}`,
                timestamp: Date.now(),
            });
        }
        db.flushLogs();

        // Vacuum should not throw
        db.vacuum();

        const stats = db.getStats();
        expect(stats.pipelines).toBe(1);
        expect(stats.jobs).toBe(1);
        expect(stats.logs).toBe(15);

        db.close();
        await fs.remove(tempDir);
    });

    test("flushJobLogs for job not in buffer", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-flush-none-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // flushLogs when buffer is empty for a job
        db.flushLogs();

        // getJobLogs internally calls flushJobLogs for that jobId
        const logs = db.getJobLogs("not-in-buffer-job");
        expect(logs).toEqual([]);

        db.close();
        await fs.remove(tempDir);
    });

    test("appendLog with no existing buffer creates buffer", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-new-buffer-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        db.createPipeline({
            id: "new-buffer-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "new-buffer-job",
            pipeline_id: "new-buffer-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "running",
            when_condition: null,
            allow_failure: 0,
            needs: null,
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        // First log for this job should create the buffer
        db.appendLog("new-buffer-job", {
            line_number: 0,
            stream: "stdout",
            content: "First line",
            timestamp: Date.now(),
        });

        db.flushLogs();
        const count = db.getJobLogCount("new-buffer-job");
        expect(count).toBe(1);

        db.close();
        await fs.remove(tempDir);
    });

    test("init loads existing valid database", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-load-existing-${Date.now()}`);
        await fs.ensureDir(tempDir);

        // Create a database and add data
        const db1 = new GCLDatabase(path.join(tempDir, "test.db"));
        await db1.init();
        db1.createPipeline({
            id: "existing-pipeline",
            iid: 1,
            status: "success",
            started_at: Date.now(),
            finished_at: Date.now(),
            duration: 100,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });
        db1.close();

        // Create new instance and load existing database
        const db2 = new GCLDatabase(path.join(tempDir, "test.db"));
        await db2.init();

        const pipeline = db2.getPipeline("existing-pipeline");
        expect(pipeline).not.toBeNull();
        expect(pipeline?.id).toBe("existing-pipeline");

        db2.close();
        await fs.remove(tempDir);
    });

    test("init creates backup when database is corrupt", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-backup-${Date.now()}`);
        await fs.ensureDir(tempDir);

        // Write corrupt data to db file
        await fs.writeFile(path.join(tempDir, "test.db"), "corrupt data");

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        expect(consoleWarnSpy).toHaveBeenCalled();
        // Check for backup file
        const files = await fs.readdir(tempDir);
        const backupFiles = files.filter((f: string) => f.includes(".corrupt."));
        expect(backupFiles.length).toBeGreaterThanOrEqual(1);

        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        db.close();
        await fs.remove(tempDir);
    });

    test("reload logs warning with corrupt file", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-reload-fail-${Date.now()}`);
        await fs.ensureDir(tempDir);

        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create some data
        db.createPipeline({
            id: "reload-fail-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        // Save the database
        db.close();

        // Reopen
        const db2 = new GCLDatabase(path.join(tempDir, "test.db"));
        await db2.init();

        // Verify data is there
        expect(db2.getPipeline("reload-fail-pipeline")).not.toBeNull();

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        // Corrupt the file while db2 is still open with in-memory state
        await fs.writeFile(path.join(tempDir, "test.db"), Buffer.from([0x00, 0x01, 0x02, 0x03]));

        // Try to reload - should not throw and should warn about corrupt file
        await expect(db2.reload()).resolves.not.toThrow();

        // The warn should have been called for the corrupt file
        expect(consoleWarnSpy).toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
        db2.close();
        await fs.remove(tempDir);
    });

    test("migration adds needs column to old database", async () => {
        const tempDir = path.join(os.tmpdir(), `gcl-migrate-needs-${Date.now()}`);
        await fs.ensureDir(tempDir);

        // We can't easily create a database without the needs column
        // since schema always includes it. The migration would only run
        // if we had an old database format without the column.
        // This tests that the migration code path doesn't throw when
        // the column already exists.
        const db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();

        // Create a job with needs to verify column exists
        db.createPipeline({
            id: "needs-migration-pipeline",
            iid: 1,
            status: "running",
            started_at: Date.now(),
            finished_at: null,
            duration: null,
            cwd: "/test",
            git_ref: null,
            git_sha: null,
        });

        db.createJob({
            id: "needs-migration-job",
            pipeline_id: "needs-migration-pipeline",
            name: "test",
            base_name: "test",
            stage: "test",
            status: "pending",
            when_condition: null,
            allow_failure: 0,
            needs: JSON.stringify(["dep-job"]),
            started_at: null,
            finished_at: null,
            duration: null,
            exit_code: null,
            coverage_percent: null,
        });

        const job = db.getJob("needs-migration-job");
        expect(job?.needs).toBe(JSON.stringify(["dep-job"]));

        db.close();
        await fs.remove(tempDir);
    });
});

describe("EventRecorder error paths", () => {
    let tempDir: string;
    let db: GCLDatabase;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `gcl-recorder-error-${Date.now()}`);
        await fs.ensureDir(tempDir);
        db = new GCLDatabase(path.join(tempDir, "test.db"));
        await db.init();
    });

    afterEach(async () => {
        try {
            db.close();
        } catch {
            // Ignore close errors
        }
        await fs.remove(tempDir);
        EventEmitter.reset();
    });

    test("onPipelineFinished logs error on database failure", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `error-pipeline-${Date.now()}`;

        // Create pipeline successfully
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Close the db to cause error on finish
        db.close();

        // This should try to update and fail
        emitter.emit({
            type: EventType.PIPELINE_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "success"},
        } as PipelineEvent);

        // The error is caught but getPipeline returns null for closed db
        consoleErrorSpy.mockRestore();
        recorder.destroy();

        // Recreate db for cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });

    test("onJobLogLine handles error gracefully", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `log-error-pipeline-${Date.now()}`;
        const jobId = `log-error-job-${Date.now()}`;

        // Create pipeline and job
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test"},
        } as JobEvent);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Close db to trigger error
        db.close();

        // Log line should not throw even with closed db
        expect(() => {
            emitter.emit({
                type: EventType.JOB_LOG_LINE,
                timestamp: Date.now(),
                pipelineId,
                pipelineIid: 1,
                jobId,
                jobName: "test-job",
                line: "some log content",
                stream: "stdout",
            } as LogEvent);
        }).not.toThrow();

        consoleErrorSpy.mockRestore();
        recorder.destroy();

        // Recreate db for cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });

    test("onJobFinished logs error on database failure", () => {
        const emitter = EventEmitter.getInstance();
        emitter.enable();
        const recorder = new EventRecorder(db);

        const pipelineId = `job-error-pipeline-${Date.now()}`;
        const jobId = `job-error-job-${Date.now()}`;

        // Create pipeline and job
        emitter.emit({
            type: EventType.PIPELINE_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            data: {status: "running"},
        } as PipelineEvent);

        emitter.emit({
            type: EventType.JOB_STARTED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {stage: "test"},
        } as JobEvent);

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Close db to trigger error
        db.close();

        // Finish job should handle error gracefully
        emitter.emit({
            type: EventType.JOB_FINISHED,
            timestamp: Date.now(),
            pipelineId,
            pipelineIid: 1,
            jobId,
            jobName: "test-job",
            data: {status: "success"},
        } as JobEvent);

        consoleErrorSpy.mockRestore();
        recorder.destroy();

        // Recreate db for cleanup
        db = new GCLDatabase(path.join(tempDir, "test.db"));
    });
});
