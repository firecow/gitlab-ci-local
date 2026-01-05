import {apiClient, Pipeline, Job, ResourceMonitorData, ContainerStats} from "../utils/api-client.js";
import {createPipelineSSE, SSEClient} from "../utils/sse-client.js";
import {formatDate, formatDuration} from "../utils/format-utils.js";
import {JobLogs} from "./job-logs.js";
import {ResourceChart} from "./resource-chart.js";

// Max history entries to keep (60 seconds at 5s intervals = 12 entries)
const MAX_HISTORY_ENTRIES = 12;

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
    private resourceMonitor: ResourceMonitorData | null = null;
    private resourceChart: ResourceChart | null = null;
    private localStatsHistory: Record<string, ContainerStats[]> = {}; // Build up history locally

    constructor (router: any, pipelineId: string) {
        super();
        this.router = router;
        this.pipelineId = pipelineId;
    }

    // Called when component is added to DOM
    connectedCallback () {
        this.loadPipeline();
        this.connectSSE();
        // Poll for updates every 5 seconds (includes resource stats)
        this.refreshInterval = window.setInterval(() => this.loadPipeline(), 5000);

        // Listen for resource chart toggle events
        this.addEventListener("toggle", async (e: Event) => {
            const detail = (e as CustomEvent).detail;
            try {
                if (detail.enabled) {
                    await apiClient.enableResourceMonitor();
                } else {
                    await apiClient.disableResourceMonitor();
                }
                // Refresh to get updated state
                await this.loadPipeline();
            } catch (err) {
                console.error("Failed to toggle resource monitor:", err);
            }
        });
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
            this.resourceMonitor = response.resourceMonitor;

            // Accumulate container stats into local history
            if (this.resourceMonitor?.containerStats) {
                this.accumulateStats(this.resourceMonitor.containerStats);
            }

            this.loading = false;
            this.render();
        } catch (error) {
            console.error("Failed to load pipeline:", error);
            this.loading = false;
            this.render();
        }
    }

    // Accumulate stats into local history for chart display
    private accumulateStats (stats: ContainerStats[]) {
        for (const stat of stats) {
            if (!this.localStatsHistory[stat.jobName]) {
                this.localStatsHistory[stat.jobName] = [];
            }

            const history = this.localStatsHistory[stat.jobName];

            // Only add if this is a new timestamp (avoid duplicates)
            const lastStat = history[history.length - 1];
            if (!lastStat || lastStat.timestamp !== stat.timestamp) {
                history.push(stat);

                // Keep only the most recent entries
                if (history.length > MAX_HISTORY_ENTRIES) {
                    history.shift();
                }
            }
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

    // Format resource stats tooltip for completed Docker jobs
    private formatResourceStats (job: Job): string {
        if (job.avg_cpu_percent === null && job.avg_memory_percent === null) {
            return "";
        }

        const parts: string[] = [];
        if (job.avg_cpu_percent !== null) {
            parts.push(`CPU: ${job.avg_cpu_percent.toFixed(1)}% avg`);
        }
        if (job.peak_cpu_percent !== null) {
            parts.push(`${job.peak_cpu_percent.toFixed(1)}% peak`);
        }
        if (job.avg_memory_percent !== null) {
            parts.push(`Mem: ${job.avg_memory_percent.toFixed(1)}% avg`);
        }
        if (job.peak_memory_percent !== null) {
            parts.push(`${job.peak_memory_percent.toFixed(1)}% peak`);
        }
        return parts.join(" | ");
    }

    // Check if pipeline has any Docker jobs (for showing resource chart)
    private hasDockerJobs (): boolean {
        // Check if any jobs have resource stats or if resource monitor has data
        const hasJobStats = this.jobs.some(j => j.avg_cpu_percent !== null);
        const hasMonitorData = this.resourceMonitor &&
            this.resourceMonitor.containerStats.length > 0;
        const hasLocalHistory = Object.keys(this.localStatsHistory).length > 0;
        return hasJobStats || !!hasMonitorData || hasLocalHistory;
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
                        const resourceStats = this.formatResourceStats(job);
                        return `
                        <div class="job-item" data-id="${job.id}" data-needs="${job.needs?.join(",") || ""}" ${resourceStats ? `title="${resourceStats}"` : ""}>
                            <div class="job-header">
                                <div class="job-name">${job.name}</div>
                                <span class="status-badge status-${job.status}">
                                    ${job.status}
                                </span>
                            </div>
                            <div class="job-meta">
                                ${job.duration ? `Duration: ${formatDuration(job.duration)}` : "Not started"}
                                ${job.exit_code !== null ? ` | Exit code: ${job.exit_code}` : ""}
                            </div>
                            ${resourceStats ? `<div class="job-resources">${resourceStats}</div>` : ""}
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

        // Resource chart HTML (only if Docker jobs exist)
        const resourceChartPlaceholder = this.hasDockerJobs() ? "<div id=\"resource-chart-container\"></div>" : "";

        this.innerHTML = `
            <div class="mb-3">
                <button class="btn btn-sm back-btn">← Back to Pipelines</button>
            </div>

            <div class="card mb-3">
                <div class="card-header flex-between">
                    <h2 class="card-title">Pipeline #${this.pipeline.iid}</h2>
                    <div class="flex gap-2">
                        <span class="status-badge status-${this.pipeline.status}">
                            ${this.pipeline.status}
                        </span>
                        ${this.pipeline.status === "running" ? `
                            <button class="btn btn-sm cancel-pipeline-btn" style="background-color: var(--color-danger); color: white; border-color: var(--color-danger);">
                                Cancel
                            </button>
                        ` : ""}
                    </div>
                </div>
                <div class="card-body">
                    <div class="pipeline-meta">
                        <span>Started: ${formatDate(this.pipeline.started_at)}</span>
                        ${this.pipeline.duration ? `<span>Duration: ${formatDuration(this.pipeline.duration)}</span>` : ""}
                        ${this.pipeline.git_ref ? `<span>Ref: ${this.pipeline.git_ref}</span>` : ""}
                        ${this.pipeline.git_sha ? `<span>SHA: ${this.pipeline.git_sha.substring(0, 8)}</span>` : ""}
                    </div>
                </div>
            </div>

            ${resourceChartPlaceholder}

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

        // Add cancel button handler
        const cancelBtn = this.querySelector(".cancel-pipeline-btn");
        cancelBtn?.addEventListener("click", async (e) => {
            e.stopPropagation();
            try {
                await apiClient.cancelPipeline();
                // Refresh after cancel
                await this.loadPipeline();
            } catch (error) {
                console.error("Failed to cancel pipeline:", error);
            }
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

        // Initialize or update resource chart
        const chartContainer = this.querySelector("#resource-chart-container");
        if (chartContainer && this.hasDockerJobs()) {
            if (!this.resourceChart) {
                this.resourceChart = new ResourceChart();
                chartContainer.appendChild(this.resourceChart);
            }

            // Update chart with locally accumulated history
            const enabled = this.resourceMonitor?.enabled ?? true;
            this.resourceChart.updateStats(this.localStatsHistory, enabled);
        }
    }
}
