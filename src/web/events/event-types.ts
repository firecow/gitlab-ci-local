// Event types for pipeline and job lifecycle
export enum EventType {
    PIPELINE_QUEUED = 'pipeline:queued',
    PIPELINE_STARTED = 'pipeline:started',
    PIPELINE_FINISHED = 'pipeline:finished',
    JOB_QUEUED = 'job:queued',
    JOB_STARTED = 'job:started',
    JOB_LOG_LINE = 'job:log',
    JOB_FINISHED = 'job:finished',
    JOB_STATUS_CHANGED = 'job:status',
}

// Base event interface
export interface BaseEvent {
    type: EventType;
    timestamp: number;
    pipelineId: string;
    pipelineIid: number;
}

// Pipeline-level event
export interface PipelineEvent extends BaseEvent {
    data: {
        status?: 'queued' | 'running' | 'success' | 'failed' | 'canceled';
        stages?: string[];
        jobCount?: number;
        failedJobs?: string[];
        cwd?: string;
        gitRef?: string;
        gitSha?: string;
    };
}

// Job-level event
export interface JobEvent extends BaseEvent {
    jobId: string;
    jobName: string;
    data: {
        stage?: string;
        status?: 'pending' | 'running' | 'success' | 'warning' | 'failed';
        when?: string;
        exitCode?: number;
        duration?: number | null;
        coverage?: number | null;
        allowFailure?: boolean;
        needs?: string[]; // Job names this job depends on
    };
}

// Log line event
export interface LogEvent extends BaseEvent {
    jobId: string;
    jobName: string;
    line: string;
    stream: 'stdout' | 'stderr';
}

// Union type of all events
export type GCLEvent = PipelineEvent | JobEvent | LogEvent;

// Event listener callback type
export type EventListener = (event: GCLEvent) => void;
