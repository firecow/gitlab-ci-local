import {apiClient, Pipeline, Job} from "../utils/api-client.js";
import {createPipelineSSE, SSEClient} from "../utils/sse-client.js";
import {JobLogs} from "./job-logs.js";

// Pipeline detail component shows pipeline info and jobs
export class PipelineDetail extends HTMLElement {
    private router: any;
    private pipelineId: string;
    private pipeline: Pipeline | null = null;
    private jobs: Job[] = [];
    private loading: boolean = true;
    private sseClient: SSEClient | null = null;
    private selectedJobId: string | null = null;
    private refreshInterval: number | null = null;

    constructor (router: any, pipelineId: string) {
        super();
        this.router = router;
        this.pipelineId = pipelineId;
    }

    // Called when component is added to DOM
    connectedCallback () {
        this.loadPipeline();
        this.connectSSE();
        // Poll for updates every 2 seconds (subprocess events don't come through SSE)
        this.refreshInterval = window.setInterval(() => this.loadPipeline(), 2000);
    }

    // Called when component is removed from DOM
    disconnectedCallback () {
        if (this.sseClient) {
            this.sseClient.close();
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    // Load pipeline data from API
    private async loadPipeline () {
        try {
            const response = await apiClient.getPipeline(this.pipelineId);
            this.pipeline = response.pipeline;
            this.jobs = response.jobs;
            this.loading = false;
            this.render();
        } catch (error) {
            console.error("Failed to load pipeline:", error);
            this.loading = false;
            this.render();
        }
    }

    // Connect to SSE for real-time updates
    private connectSSE () {
        this.sseClient = createPipelineSSE(this.pipelineId);

        // Listen for job status changes
        this.sseClient.on("job:status", (event) => {
            const job = this.jobs.find(j => j.id === event.jobId);
            if (job) {
                job.status = event.data.status;
                this.render();
            }
        });

        // Listen for pipeline updates
        this.sseClient.on("pipeline:finished", (event) => {
            if (this.pipeline) {
                this.pipeline.status = event.data.status;
                this.render();
            }
        });

        this.sseClient.connect();
    }

    // Format timestamp to readable date
    private formatDate (timestamp: number | null): string {
        if (!timestamp) return "N/A";
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // Format duration to human readable format
    private formatDuration (duration: number | null): string {
        if (!duration) return "N/A";
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Group jobs by stage
    private groupJobsByStage (): Map<string, Job[]> {
        const stages = new Map<string, Job[]>();
        this.jobs.forEach(job => {
            if (!stages.has(job.stage)) {
                stages.set(job.stage, []);
            }
            stages.get(job.stage)!.push(job);
        });
        return stages;
    }

    // Handle job click to show logs
    private handleJobClick (jobId: string) {
        this.selectedJobId = jobId;
        this.renderJobLogs();
    }

    // Render job logs in a modal or separate section
    private renderJobLogs () {
        if (!this.selectedJobId) return;

        const job = this.jobs.find(j => j.id === this.selectedJobId);
        if (!job) return;

        // Find or create logs container
        let logsContainer = this.querySelector(".job-logs-container");
        if (!logsContainer) {
            logsContainer = document.createElement("div");
            logsContainer.className = "job-logs-container";
            this.appendChild(logsContainer);
        }

        // Clear and render job logs component
        logsContainer.innerHTML = `
            <div class="card">
                <div class="card-header flex-between">
                    <h3 class="card-title">Job: ${job.name}</h3>
                    <button class="btn btn-sm close-logs-btn">Close</button>
                </div>
                <div id="job-logs-content"></div>
            </div>
        `;

        // Add close button handler
        const closeBtn = logsContainer.querySelector(".close-logs-btn");
        closeBtn?.addEventListener("click", () => {
            this.selectedJobId = null;
            logsContainer?.remove();
        });

        // Render job logs
        const logsContent = logsContainer.querySelector("#job-logs-content");
        if (logsContent) {
            const jobLogs = new JobLogs(this.selectedJobId);
            logsContent.appendChild(jobLogs);
        }
    }

    // Render component
    private render () {
        if (this.loading) {
            this.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                </div>
            `;
            return;
        }

        if (!this.pipeline) {
            this.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <div class="empty-state-text">Pipeline not found</div>
                </div>
            `;
            return;
        }

        const stageGroups = this.groupJobsByStage();
        const stagesHTML = Array.from(stageGroups.entries()).map(([stage, jobs]) => `
            <div class="stage-group mb-3">
                <h3 class="text-muted mb-2">Stage: ${stage}</h3>
                <div class="job-list">
                    ${jobs.map(job => {
                        const needsInStage = job.needs?.filter(n => jobs.some(j => j.name === n)) || [];
                        const needsFromOtherStages = job.needs?.filter(n => !jobs.some(j => j.name === n)) || [];
                        return `
                        <div class="job-item" data-id="${job.id}" data-needs="${job.needs?.join(",") || ""}">
                            <div class="job-header">
                                <div class="job-name">${job.name}</div>
                                <span class="status-badge status-${job.status}">
                                    ${job.status}
                                </span>
                            </div>
                            <div class="job-meta">
                                ${job.duration ? `Duration: ${this.formatDuration(job.duration)}` : "Not started"}
                                ${job.exit_code !== null ? ` | Exit code: ${job.exit_code}` : ""}
                            </div>
                            ${needsInStage.length > 0 ? `
                                <div class="job-needs">
                                    <span class="needs-label">⏳ waits for:</span>
                                    ${needsInStage.map(n => `<span class="needs-job">${n}</span>`).join("")}
                                </div>
                            ` : ""}
                            ${needsFromOtherStages.length > 0 ? `
                                <div class="job-needs job-needs-external">
                                    <span class="needs-label">↩ needs:</span>
                                    ${needsFromOtherStages.map(n => `<span class="needs-job">${n}</span>`).join("")}
                                </div>
                            ` : ""}
                        </div>
                    `;}).join("")}
                </div>
            </div>
        `).join("");

        this.innerHTML = `
            <div class="mb-3">
                <button class="btn btn-sm back-btn">← Back to Pipelines</button>
            </div>

            <div class="card mb-3">
                <div class="card-header flex-between">
                    <h2 class="card-title">Pipeline #${this.pipeline.iid}</h2>
                    <span class="status-badge status-${this.pipeline.status}">
                        ${this.pipeline.status}
                    </span>
                </div>
                <div class="card-body">
                    <div class="pipeline-meta">
                        <span>Started: ${this.formatDate(this.pipeline.started_at)}</span>
                        ${this.pipeline.duration ? `<span>Duration: ${this.formatDuration(this.pipeline.duration)}</span>` : ""}
                        ${this.pipeline.git_ref ? `<span>Ref: ${this.pipeline.git_ref}</span>` : ""}
                        ${this.pipeline.git_sha ? `<span>SHA: ${this.pipeline.git_sha.substring(0, 8)}</span>` : ""}
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Jobs</h3>
                </div>
                <div class="card-body">
                    ${stagesHTML}
                </div>
            </div>
        `;

        // Add back button handler
        const backBtn = this.querySelector(".back-btn");
        backBtn?.addEventListener("click", () => {
            this.router.navigate("/");
        });

        // Add job click handlers
        this.querySelectorAll(".job-item").forEach(item => {
            item.addEventListener("click", () => {
                const jobId = item.getAttribute("data-id");
                if (jobId) {
                    this.handleJobClick(jobId);
                }
            });
        });
    }
}
