import {EventEmitter} from "./event-emitter.js";
import {EventType, PipelineEvent, JobEvent, LogEvent, GCLEvent} from "./event-types.js";
import {GCLDatabase} from "../persistence/database.js";

// Records events to the database
export class EventRecorder {
    private db: GCLDatabase;
    private emitter: EventEmitter;
    private lineNumbers: Map<string, number> = new Map();
    private jobIdMap: Map<string, string> = new Map(); // Maps event jobId to actual db jobId
    // Store bound listener references for cleanup
    private boundListeners: Map<EventType, (event: GCLEvent) => void> = new Map();

    constructor (db: GCLDatabase) {
        this.db = db;
        this.emitter = EventEmitter.getInstance();
        this.registerListeners();
    }

    private registerListeners () {
        // Store bound references so we can remove them later
        const listeners: Array<[EventType, (event: GCLEvent) => void]> = [
            [EventType.PIPELINE_QUEUED, this.onPipelineQueued.bind(this)],
            [EventType.PIPELINE_STARTED, this.onPipelineStarted.bind(this)],
            [EventType.PIPELINE_FINISHED, this.onPipelineFinished.bind(this)],
            [EventType.JOB_QUEUED, this.onJobQueued.bind(this)],
            [EventType.JOB_STARTED, this.onJobStarted.bind(this)],
            [EventType.JOB_LOG_LINE, this.onJobLogLine.bind(this)],
            [EventType.JOB_FINISHED, this.onJobFinished.bind(this)],
        ];

        for (const [type, listener] of listeners) {
            this.boundListeners.set(type, listener);
            this.emitter.on(type, listener);
        }
    }

    private onPipelineQueued (event: GCLEvent) {
        const pipelineEvent = event as PipelineEvent;
        try {
            this.db.createPipeline({
                id: pipelineEvent.pipelineId,
                iid: pipelineEvent.pipelineIid,
                status: "queued",
                started_at: null,
                finished_at: null,
                duration: null,
                cwd: pipelineEvent.data.cwd || process.cwd(),
                git_ref: pipelineEvent.data.gitRef || null,
                git_sha: pipelineEvent.data.gitSha || null,
            });
        } catch (error) {
            console.error("Error recording pipeline queued event:", error);
        }
    }

    private onPipelineStarted (event: GCLEvent) {
        const pipelineEvent = event as PipelineEvent;
        try {
            // Check if pipeline exists, create if not
            const existing = this.db.getPipeline(pipelineEvent.pipelineId);
            if (!existing) {
                this.db.createPipeline({
                    id: pipelineEvent.pipelineId,
                    iid: pipelineEvent.pipelineIid,
                    status: "running",
                    started_at: pipelineEvent.timestamp,
                    finished_at: null,
                    duration: null,
                    cwd: pipelineEvent.data.cwd || process.cwd(),
                    git_ref: pipelineEvent.data.gitRef || null,
                    git_sha: pipelineEvent.data.gitSha || null,
                });
            } else {
                this.db.updatePipeline(pipelineEvent.pipelineId, {
                    status: "running",
                    started_at: pipelineEvent.timestamp,
                });
            }
        } catch (error) {
            console.error("Error recording pipeline started event:", error);
        }
    }

    private onPipelineFinished (event: GCLEvent) {
        const pipelineEvent = event as PipelineEvent;
        try {
            const pipeline = this.db.getPipeline(pipelineEvent.pipelineId);
            if (!pipeline) {
                console.warn(`Pipeline ${pipelineEvent.pipelineId} not found for finished event`);
                return;
            }

            const duration = pipeline.started_at ? pipelineEvent.timestamp - pipeline.started_at : null;
            this.db.updatePipeline(pipelineEvent.pipelineId, {
                status: pipelineEvent.data.status || "success",
                finished_at: pipelineEvent.timestamp,
                duration,
            });

            this.db.flushLogs(); // Flush any pending logs
        } catch (error) {
            console.error("Error recording pipeline finished event:", error);
        }
    }

    private onJobQueued (event: GCLEvent) {
        const jobEvent = event as JobEvent;
        try {
            this.db.createJob({
                id: jobEvent.jobId,
                pipeline_id: jobEvent.pipelineId,
                name: jobEvent.jobName,
                base_name: jobEvent.jobName.replace(/\s*\[.*\]$/, ""), // Remove matrix suffix
                stage: jobEvent.data.stage || "unknown",
                status: "pending",
                when_condition: jobEvent.data.when || null,
                allow_failure: jobEvent.data.allowFailure ? 1 : 0,
                needs: jobEvent.data.needs ? JSON.stringify(jobEvent.data.needs) : null,
                started_at: null,
                finished_at: null,
                duration: null,
                exit_code: null,
                coverage_percent: null,
            });

            this.lineNumbers.set(jobEvent.jobId, 0); // Initialize line number counter
        } catch (error) {
            console.error("Error recording job queued event:", error);
        }
    }

    private onJobStarted (event: GCLEvent) {
        const jobEvent = event as JobEvent;
        try {
            // Check if job exists by ID or by pipeline+name (for pending jobs created by web UI)
            let existing = this.db.getJob(jobEvent.jobId);
            if (!existing) {
                existing = this.db.getJobByPipelineAndName(jobEvent.pipelineId, jobEvent.jobName);
            }

            if (!existing) {
                this.db.createJob({
                    id: jobEvent.jobId,
                    pipeline_id: jobEvent.pipelineId,
                    name: jobEvent.jobName,
                    base_name: jobEvent.jobName.replace(/\s*\[.*\]$/, ""),
                    stage: jobEvent.data.stage || "unknown",
                    status: "running",
                    when_condition: jobEvent.data.when || null,
                    allow_failure: jobEvent.data.allowFailure ? 1 : 0,
                    needs: jobEvent.data.needs ? JSON.stringify(jobEvent.data.needs) : null,
                    started_at: jobEvent.timestamp,
                    finished_at: null,
                    duration: null,
                    exit_code: null,
                    coverage_percent: null,
                });
                this.lineNumbers.set(jobEvent.jobId, 0);
            } else {
                // Update the existing job (may have been created as pending by web UI)
                this.db.updateJob(existing.id, {
                    status: "running",
                    started_at: jobEvent.timestamp,
                    stage: jobEvent.data.stage || existing.stage,
                });
                this.lineNumbers.set(existing.id, 0);
                // Map the event's jobId to the actual database jobId
                if (existing.id !== jobEvent.jobId) {
                    this.jobIdMap.set(jobEvent.jobId, existing.id);
                }
            }
        } catch (error) {
            console.error("Error recording job started event:", error);
        }
    }

    private onJobLogLine (event: GCLEvent) {
        const logEvent = event as LogEvent;
        try {
            // Resolve actual job ID (may be mapped from pending job)
            const actualJobId = this.jobIdMap.get(logEvent.jobId) || logEvent.jobId;

            // Get and increment line number
            const lineNumber = this.lineNumbers.get(actualJobId) || 0;
            this.lineNumbers.set(actualJobId, lineNumber + 1);

            // Append log (buffered)
            this.db.appendLog(actualJobId, {
                line_number: lineNumber,
                stream: logEvent.stream,
                content: logEvent.line,
                timestamp: logEvent.timestamp,
            });
        } catch (error) {
            console.error("Error recording job log line event:", error);
        }
    }

    private onJobFinished (event: GCLEvent) {
        const jobEvent = event as JobEvent;
        try {
            // Resolve actual job ID (may be mapped from pending job)
            const actualJobId = this.jobIdMap.get(jobEvent.jobId) || jobEvent.jobId;

            const job = this.db.getJob(actualJobId);
            if (!job) {
                console.warn(`Job ${actualJobId} not found for finished event`);
                return;
            }

            const duration = job.started_at ? jobEvent.timestamp - job.started_at : null;
            this.db.updateJob(actualJobId, {
                status: jobEvent.data.status || "success",
                finished_at: jobEvent.timestamp,
                duration,
                exit_code: jobEvent.data.exitCode !== undefined ? jobEvent.data.exitCode : null,
                coverage_percent: jobEvent.data.coverage !== undefined ? jobEvent.data.coverage : null,
            });

            this.db.flushLogs(); // Flush logs for this job
            this.lineNumbers.delete(actualJobId); // Clean up line number counter
            this.jobIdMap.delete(jobEvent.jobId); // Clean up ID mapping
        } catch (error) {
            console.error("Error recording job finished event:", error);
        }
    }

    cleanup () {
        this.db.flushLogs();
    }

    // Unregister all listeners and clean up resources
    destroy () {
        this.db.flushLogs();
        // Remove all registered listeners
        for (const [type, listener] of this.boundListeners) {
            this.emitter.off(type, listener);
        }
        this.boundListeners.clear();
        this.lineNumbers.clear();
        this.jobIdMap.clear();
    }
}
