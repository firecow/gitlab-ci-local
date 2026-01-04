// Type definitions for API responses
export interface Pipeline {
    id: string;
    iid: number;
    status: string;
    started_at: number | null;
    finished_at: number | null;
    duration: number | null;
    cwd: string;
    git_ref: string | null;
    git_sha: string | null;
    created_at: number;
}

export interface Job {
    id: string;
    pipeline_id: string;
    name: string;
    base_name: string;
    stage: string;
    status: string;
    when_condition: string | null;
    allow_failure: boolean;
    needs: string[] | null; // Job names this job depends on
    started_at: number | null;
    finished_at: number | null;
    duration: number | null;
    exit_code: number | null;
    coverage_percent: number | null;
}

export interface LogLine {
    line_number: number;
    stream: string;
    content: string;
    timestamp: number;
}

export interface Artifact {
    id: number;
    job_id: string;
    file_path: string;
    size: number;
}

export interface Stats {
    pipelineCount: number;
    jobCount: number;
    logCount: number;
    artifactCount: number;
    connections: number;
}

// API client for making requests to the backend
export class APIClient {
    private baseURL: string;

    constructor (baseURL: string = "/api") {
        this.baseURL = baseURL;
    }

    // Generic fetch wrapper with error handling
    private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({error: "Unknown error"}));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Pipeline endpoints
    async listPipelines (limit: number = 20, offset: number = 0): Promise<{pipelines: Pipeline[]}> {
        return this.fetch(`/pipelines?limit=${limit}&offset=${offset}`);
    }

    async getPipeline (id: string): Promise<{pipeline: Pipeline; jobs: Job[]}> {
        return this.fetch(`/pipelines/${id}`);
    }

    async listJobs (pipelineId: string): Promise<{jobs: Job[]}> {
        return this.fetch(`/pipelines/${pipelineId}/jobs`);
    }

    async getExpandedYaml (pipelineId: string): Promise<{yaml: string}> {
        return this.fetch(`/pipelines/${pipelineId}/yaml`);
    }

    // Job endpoints
    async getJob (id: string): Promise<{job: Job}> {
        return this.fetch(`/jobs/${id}`);
    }

    async getJobLogs (id: string, offset: number = 0, limit: number = 1000): Promise<{logs: LogLine[]; total: number}> {
        return this.fetch(`/jobs/${id}/logs?offset=${offset}&limit=${limit}`);
    }

    // Artifact endpoints
    async listArtifacts (jobId: string): Promise<{artifacts: Artifact[]}> {
        return this.fetch(`/jobs/${jobId}/artifacts`);
    }

    getArtifactDownloadURL (jobId: string, path: string): string {
        return `${this.baseURL}/jobs/${jobId}/artifacts/${path}`;
    }

    // Stats endpoint
    async getStats (): Promise<Stats> {
        return this.fetch("/stats");
    }
}

// Export singleton instance
export const apiClient = new APIClient();
