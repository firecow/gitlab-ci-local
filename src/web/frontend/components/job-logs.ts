import {apiClient, LogLine} from "../utils/api-client.js";
import {createPipelineSSE, SSEClient} from "../utils/sse-client.js";

// Job logs component displays real-time job logs
export class JobLogs extends HTMLElement {
    private jobId: string;
    private logs: LogLine[] = [];
    private loading: boolean = true;
    private sseClient: SSEClient | null = null;
    private autoScroll: boolean = true;

    constructor (jobId: string) {
        super();
        this.jobId = jobId;
    }

    // Called when component is added to DOM
    connectedCallback () {
        this.loadLogs();
        this.connectSSE();
    }

    // Called when component is removed from DOM
    disconnectedCallback () {
        if (this.sseClient) {
            this.sseClient.close();
        }
    }

    // Load initial logs from API
    private async loadLogs () {
        try {
            const response = await apiClient.getJobLogs(this.jobId, 0, 10000);
            this.logs = response.logs;
            this.loading = false;
            this.render();
            this.scrollToBottom();
        } catch (error) {
            console.error("Failed to load logs:", error);
            this.loading = false;
            this.render();
        }
    }

    // Connect to SSE for real-time log streaming
    private connectSSE () {
        // Get job details to find pipeline ID
        apiClient.getJob(this.jobId).then(({job}) => {
            this.sseClient = createPipelineSSE(job.pipeline_id);

            // Listen for new log lines for this job
            this.sseClient.on("job:log", (event) => {
                if (event.jobId === this.jobId) {
                    this.logs.push({
                        line_number: this.logs.length,
                        stream: event.stream,
                        content: event.line,
                        timestamp: event.timestamp,
                    });
                    this.renderNewLog(event.line, this.logs.length - 1);
                    if (this.autoScroll) {
                        this.scrollToBottom();
                    }
                }
            });

            this.sseClient.connect();
        }).catch(error => {
            console.error("Failed to get job info for SSE:", error);
        });
    }

    // Scroll to bottom of logs
    private scrollToBottom () {
        const logViewer = this.querySelector(".log-viewer");
        if (logViewer) {
            logViewer.scrollTop = logViewer.scrollHeight;
        }
    }

    // Render a new log line (append only)
    private renderNewLog (content: string, lineNumber: number) {
        const logViewer = this.querySelector(".log-viewer");
        if (!logViewer) return;

        const logLine = document.createElement("div");
        logLine.className = "log-line";
        logLine.innerHTML = `
            <span class="log-line-number">${lineNumber + 1}</span>
            <span>${this.escapeHtml(content)}</span>
        `;
        logViewer.appendChild(logLine);
    }

    // Escape HTML to prevent XSS
    private escapeHtml (text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // Toggle auto-scroll
    private toggleAutoScroll () {
        this.autoScroll = !this.autoScroll;
        const checkbox = this.querySelector(".auto-scroll-checkbox") as HTMLInputElement;
        if (checkbox) {
            checkbox.checked = this.autoScroll;
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

        if (this.logs.length === 0) {
            this.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-text">No logs available</div>
                </div>
            `;
            return;
        }

        const logsHTML = this.logs.map((log) => `
            <div class="log-line">
                <span class="log-line-number">${log.line_number + 1}</span>
                <span>${this.escapeHtml(log.content)}</span>
            </div>
        `).join("");

        this.innerHTML = `
            <div class="logs-controls mb-2 flex-between">
                <div>
                    <label>
                        <input type="checkbox" class="auto-scroll-checkbox" ${this.autoScroll ? "checked" : ""}>
                        Auto-scroll
                    </label>
                </div>
                <div class="text-muted">
                    ${this.logs.length} lines
                </div>
            </div>
            <div class="log-viewer">
                ${logsHTML}
            </div>
        `;

        // Add auto-scroll toggle handler
        const checkbox = this.querySelector(".auto-scroll-checkbox");
        checkbox?.addEventListener("change", () => this.toggleAutoScroll());
    }
}
