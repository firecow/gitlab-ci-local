import {EventEmitter} from "./event-emitter.js";
import {EventType, PipelineEvent, PipelineInitEvent, JobEvent, LogEvent, GCLEvent} from "./event-types.js";
import {GCLDatabase} from "../persistence/database.js";
import {LogFileManager} from "../persistence/log-file-manager.js";

// Records events to the database and log files
export class EventRecorder {
    private db: GCLDatabase;
    private logFileManager: LogFileManager | null;
    private emitter: EventEmitter;
    private lineNumbers: Map<string, number> = new Map();
    private jobPipelineMap: Map<string, string> = new Map(); // Maps jobId to pipelineId for file logging
    private jobIdMap: Map<string, string> = new Map(); // Maps event jobId to actual db jobId
    // Store bound listener references for cleanup
    private boundListeners: Map<EventType, (event: GCLEvent) => void> = new Map();

    constructor (db: GCLDatabase, logFileManager?: LogFileManager) {
        this.db = db;
        this.logFileManager = logFileManager || null;
        this.emitter = EventEmitter.getInstance();
        this.registerListeners();
    }

    private registerListeners () {
        // Store bound references so we can remove them later
        const listeners: Array<[EventType, (event: GCLEvent) => void]> = [
            [EventType.PIPELINE_QUEUED, this.onPipelineQueued.bind(this)],
            [EventType.PIPELINE_INIT_PHASE, this.onPipelineInitPhase.bind(this)],
            [EventType.PIPELINE_STARTED, this.onPipelineStarted.bind(this)],
            [EventType.PIPELINE_FINISHED, this.onPipelineFinished.bind(this)],
            [EventType.JOB_QUEUED, this.onJobQueued.bind(this)],
            [EventType.JOB_STARTED, this.onJobStarted.bind(this)],
            [EventType.JOB_CONTAINER_CREATED, this.onJobContainerCreated.bind(this)],
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

    private onPipelineInitPhase (event: GCLEvent) {
        const initEvent = event as PipelineInitEvent;
        try {
            // Check if pipeline exists by ID or by IID (for web UI pending pipelines)
            let existing = this.db.getPipeline(initEvent.pipelineId);
            if (!existing) {
                existing = this.db.getPipelineByIid(initEvent.pipelineIid);
            }
            if (!existing) {
                this.db.createPipeline({
                    id: initEvent.pipelineId,
                    iid: initEvent.pipelineIid,
                    status: "queued",
                    started_at: null,
                    finished_at: null,
                    duration: null,
                    cwd: process.cwd(),
                    git_ref: null,
                    git_sha: null,
                });
                this.db.updatePipeline(initEvent.pipelineId, {
                    init_phase: initEvent.phase,
                    init_message: initEvent.message,
                    init_progress: initEvent.progress ?? null,
                });
            } else {
                this.db.updatePipeline(existing.id, {
                    init_phase: initEvent.phase,
                    init_message: initEvent.message,
                    init_progress: initEvent.progress ?? null,
                });
            }
        } catch (error) {
            console.error("Error recording pipeline init phase event:", error);
        }
    }

    private onPipelineStarted (event: GCLEvent) {
        const pipelineEvent = event as PipelineEvent;
        try {
            // Check if pipeline exists by ID or by IID (for web UI pending pipelines)
            let existing = this.db.getPipeline(pipelineEvent.pipelineId);
            if (!existing) {
                existing = this.db.getPipelineByIid(pipelineEvent.pipelineIid);
            }
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
                this.db.updatePipeline(existing.id, {
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
            // Check if pipeline exists by ID or by IID (for web UI pending pipelines)
            let pipeline = this.db.getPipeline(pipelineEvent.pipelineId);
            if (!pipeline) {
                pipeline = this.db.getPipelineByIid(pipelineEvent.pipelineIid);
            }
            if (!pipeline) {
                console.warn(`Pipeline ${pipelineEvent.pipelineId} not found for finished event`);
                return;
            }

            const duration = pipeline.started_at ? pipelineEvent.timestamp - pipeline.started_at : null;
            this.db.updatePipeline(pipeline.id, {
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
            // Resolve actual pipeline ID (may differ from event's pipelineId in web UI mode)
            const pipeline = this.db.getPipeline(jobEvent.pipelineId) || this.db.getPipelineByIid(jobEvent.pipelineIid);
            const actualPipelineId = pipeline?.id || jobEvent.pipelineId;

            this.db.createJob({
                id: jobEvent.jobId,
                pipeline_id: actualPipelineId,
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
                container_id: null,
                avg_cpu_percent: null,
                avg_memory_percent: null,
                peak_cpu_percent: null,
                peak_memory_percent: null,
            });

            this.lineNumbers.set(jobEvent.jobId, 0); // Initialize line number counter
            this.jobPipelineMap.set(jobEvent.jobId, actualPipelineId); // Track pipeline for file logging
        } catch (error) {
            console.error("Error recording job queued event:", error);
        }
    }

    private onJobStarted (event: GCLEvent) {
        const jobEvent = event as JobEvent;
        try {
            // Resolve actual pipeline ID (may differ from event's pipelineId in web UI mode)
            const pipeline = this.db.getPipeline(jobEvent.pipelineId) || this.db.getPipelineByIid(jobEvent.pipelineIid);
            const actualPipelineId = pipeline?.id || jobEvent.pipelineId;

            // Check if job exists by ID or by pipeline+name (for pending jobs created by web UI)
            let existing = this.db.getJob(jobEvent.jobId);
            if (!existing) {
                existing = this.db.getJobByPipelineAndName(actualPipelineId, jobEvent.jobName);
            }

            if (!existing) {
                this.db.createJob({
                    id: jobEvent.jobId,
                    pipeline_id: actualPipelineId,
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
                    container_id: null,
                    avg_cpu_percent: null,
                    avg_memory_percent: null,
                    peak_cpu_percent: null,
                    peak_memory_percent: null,
                });
                this.lineNumbers.set(jobEvent.jobId, 0);
                this.jobPipelineMap.set(jobEvent.jobId, actualPipelineId);
            } else {
                // Update the existing job (may have been created as pending by web UI)
                this.db.updateJob(existing.id, {
                    status: "running",
                    started_at: jobEvent.timestamp,
                    stage: jobEvent.data.stage || existing.stage,
                });
                this.lineNumbers.set(existing.id, 0);
                this.jobPipelineMap.set(existing.id, actualPipelineId);
                // Map the event's jobId to the actual database jobId
                if (existing.id !== jobEvent.jobId) {
                    this.jobIdMap.set(jobEvent.jobId, existing.id);
                }
            }
        } catch (error) {
            console.error("Error recording job started event:", error);
        }
    }

    private onJobContainerCreated (event: GCLEvent) {
        const jobEvent = event as JobEvent;
        try {
            // Resolve actual job ID (may be mapped from pending job)
            const actualJobId = this.jobIdMap.get(jobEvent.jobId) || jobEvent.jobId;

            // Update job with container ID
            if (jobEvent.data.containerId) {
                this.db.updateJob(actualJobId, {
                    container_id: jobEvent.data.containerId,
                });
            }
        } catch (error) {
            console.error("Error recording job container created event:", error);
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

            // Write to log file if file manager is available (preferred for memory efficiency)
            if (this.logFileManager) {
                const pipelineId = this.jobPipelineMap.get(actualJobId) || logEvent.pipelineId;
                this.logFileManager.appendLog(pipelineId, actualJobId, {
                    stream: logEvent.stream,
                    content: logEvent.line,
                    timestamp: logEvent.timestamp,
                }, lineNumber);
            } else {
                // Fallback to database storage
                this.db.appendLog(actualJobId, {
                    line_number: lineNumber,
                    stream: logEvent.stream,
                    content: logEvent.line,
                    timestamp: logEvent.timestamp,
                });
            }
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
            const resourceStats = jobEvent.data.resourceStats as {avgCpu: number; avgMemory: number; peakCpu: number; peakMemory: number} | undefined;
            this.db.updateJob(actualJobId, {
                status: jobEvent.data.status || "success",
                finished_at: jobEvent.timestamp,
                duration,
                exit_code: jobEvent.data.exitCode !== undefined ? jobEvent.data.exitCode : null,
                coverage_percent: jobEvent.data.coverage !== undefined ? jobEvent.data.coverage : null,
                avg_cpu_percent: resourceStats?.avgCpu ?? null,
                avg_memory_percent: resourceStats?.avgMemory ?? null,
                peak_cpu_percent: resourceStats?.peakCpu ?? null,
                peak_memory_percent: resourceStats?.peakMemory ?? null,
            });

            // Flush logs for this job
            if (this.logFileManager) {
                const pipelineId = this.jobPipelineMap.get(actualJobId) || jobEvent.pipelineId;
                this.logFileManager.flushJob(pipelineId, actualJobId);
            } else {
                this.db.flushLogs();
            }
            this.lineNumbers.delete(actualJobId); // Clean up line number counter
            this.jobPipelineMap.delete(actualJobId); // Clean up pipeline mapping
            this.jobIdMap.delete(jobEvent.jobId); // Clean up ID mapping
        } catch (error) {
            console.error("Error recording job finished event:", error);
        }
    }

    cleanup () {
        if (this.logFileManager) {
            this.logFileManager.flushAll();
        } else {
            this.db.flushLogs();
        }
    }

    // Unregister all listeners and clean up resources
    destroy () {
        if (this.logFileManager) {
            this.logFileManager.flushAll();
        } else {
            this.db.flushLogs();
        }
        // Remove all registered listeners
        for (const [type, listener] of this.boundListeners) {
            this.emitter.off(type, listener);
        }
        this.boundListeners.clear();
        this.lineNumbers.clear();
        this.jobPipelineMap.clear();
        this.jobIdMap.clear();
    }
}
