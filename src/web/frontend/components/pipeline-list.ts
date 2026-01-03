import {apiClient, Pipeline} from "../utils/api-client.js";

// Pipeline list component displays recent pipelines
export class PipelineList extends HTMLElement {
    private router: any;
    private pipelines: Pipeline[] = [];
    private loading: boolean = true;
    private refreshInterval: number | null = null;

    constructor (router: any) {
        super();
        this.router = router;
    }

    // Called when component is added to DOM
    connectedCallback () {
        this.loadPipelines();
        // Auto-refresh every 5 seconds
        this.refreshInterval = window.setInterval(() => this.loadPipelines(), 5000);
    }

    // Called when component is removed from DOM
    disconnectedCallback () {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    // Load pipelines from API
    private async loadPipelines () {
        try {
            const response = await apiClient.listPipelines(20, 0);
            this.pipelines = response.pipelines;
            this.loading = false;
            this.render();
        } catch (error) {
            console.error("Failed to load pipelines:", error);
            this.loading = false;
            this.render();
        }
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

    // Handle pipeline click
    private handlePipelineClick (pipelineId: string) {
        this.router.navigate(`/pipelines/${pipelineId}`);
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

        if (this.pipelines.length === 0) {
            this.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">No pipelines found</div>
                </div>
            `;
            return;
        }

        const pipelinesHTML = this.pipelines.map(pipeline => `
            <div class="pipeline-item" data-id="${pipeline.id}">
                <div class="pipeline-header">
                    <div class="pipeline-id">
                        Pipeline #${pipeline.iid}
                    </div>
                    <div>
                        <span class="status-badge status-${pipeline.status}">
                            ${pipeline.status}
                        </span>
                    </div>
                </div>
                <div class="pipeline-meta">
                    <span>Started: ${this.formatDate(pipeline.started_at)}</span>
                    ${pipeline.duration ? `<span>Duration: ${this.formatDuration(pipeline.duration)}</span>` : ""}
                    ${pipeline.git_ref ? `<span>Ref: ${pipeline.git_ref}</span>` : ""}
                </div>
            </div>
        `).join("");

        this.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Recent Pipelines</h2>
                </div>
                <div class="pipeline-list">
                    ${pipelinesHTML}
                </div>
            </div>
        `;

        // Add click handlers
        this.querySelectorAll(".pipeline-item").forEach(item => {
            item.addEventListener("click", () => {
                const pipelineId = item.getAttribute("data-id");
                if (pipelineId) {
                    this.handlePipelineClick(pipelineId);
                }
            });
        });
    }
}
