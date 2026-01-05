import {ContainerStats} from "../utils/api-client.js";

// Declare Chart.js global (loaded from script tag)
declare const Chart: any;

// Colors for different jobs
const JOB_COLORS = [
    {cpu: "#4CAF50", memory: "#81C784"}, // Green
    {cpu: "#2196F3", memory: "#64B5F6"}, // Blue
    {cpu: "#FF9800", memory: "#FFB74D"}, // Orange
    {cpu: "#9C27B0", memory: "#BA68C8"}, // Purple
    {cpu: "#F44336", memory: "#E57373"}, // Red
    {cpu: "#00BCD4", memory: "#4DD0E1"}, // Cyan
    {cpu: "#795548", memory: "#A1887F"}, // Brown
    {cpu: "#607D8B", memory: "#90A4AE"}, // Blue Grey
];

const STORAGE_KEY = "gcl-resource-monitor-enabled";

export class ResourceChart extends HTMLElement {
    private chart: any = null;
    private enabled: boolean = true;
    private statsHistory: Record<string, ContainerStats[]> = {};
    private jobColorMap: Map<string, {cpu: string; memory: string}> = new Map();
    private colorIndex: number = 0;

    constructor () {
        super();
        // Load saved preference
        const saved = localStorage.getItem(STORAGE_KEY);
        this.enabled = saved !== "false"; // Default to enabled
    }

    connectedCallback () {
        this.render();
        this.initChart();
    }

    disconnectedCallback () {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    // Get color for a job (consistent across updates)
    private getJobColor (jobName: string): {cpu: string; memory: string} {
        if (!this.jobColorMap.has(jobName)) {
            this.jobColorMap.set(jobName, JOB_COLORS[this.colorIndex % JOB_COLORS.length]);
            this.colorIndex++;
        }
        return this.jobColorMap.get(jobName)!;
    }

    // Update with new stats data
    updateStats (statsHistory: Record<string, ContainerStats[]>, enabled: boolean) {
        this.statsHistory = statsHistory;
        const wasEnabled = this.enabled;
        this.enabled = enabled;

        // Update toggle button state
        const toggle = this.querySelector(".resource-toggle") as HTMLButtonElement;
        if (toggle) {
            toggle.textContent = enabled ? "Disable Graph" : "Enable Graph";
            toggle.classList.toggle("btn-active", enabled);
        }

        // Show/hide chart container
        const chartContainer = this.querySelector(".chart-container") as HTMLElement;
        if (chartContainer) {
            chartContainer.style.display = enabled ? "block" : "none";
        }

        // Show/hide disabled message
        const disabledMsg = this.querySelector(".chart-disabled-msg") as HTMLElement;
        if (disabledMsg) {
            disabledMsg.style.display = enabled ? "none" : "block";
        }

        if (enabled && this.chart) {
            this.updateChartData();
        }
    }

    // Check if monitoring is enabled
    isEnabled (): boolean {
        return this.enabled;
    }

    // Get the saved preference
    getSavedPreference (): boolean {
        return localStorage.getItem(STORAGE_KEY) !== "false";
    }

    private render () {
        this.innerHTML = `
            <div class="resource-monitor card mb-3">
                <div class="card-header flex-between">
                    <h3 class="card-title">Resource Usage</h3>
                    <button class="btn btn-sm resource-toggle ${this.enabled ? "btn-active" : ""}">
                        ${this.enabled ? "Disable Graph" : "Enable Graph"}
                    </button>
                </div>
                <div class="card-body">
                    <div class="chart-container" style="display: ${this.enabled ? "block" : "none"}; height: 200px; position: relative;">
                        <canvas id="resource-chart"></canvas>
                    </div>
                    <div class="chart-disabled-msg" style="display: ${this.enabled ? "none" : "block"}; text-align: center; padding: 20px; color: #888;">
                        Resource monitoring disabled. Click "Enable Graph" to view CPU and memory usage.
                    </div>
                </div>
            </div>
        `;

        // Add toggle handler
        const toggle = this.querySelector(".resource-toggle") as HTMLButtonElement;
        toggle?.addEventListener("click", () => this.handleToggle());
    }

    private async handleToggle () {
        const newEnabled = !this.enabled;

        // Save preference to localStorage
        localStorage.setItem(STORAGE_KEY, String(newEnabled));

        // Dispatch event to notify parent component
        this.dispatchEvent(new CustomEvent("toggle", {
            detail: {enabled: newEnabled},
            bubbles: true,
        }));
    }

    private initChart () {
        if (!this.enabled) return;

        const canvas = this.querySelector("#resource-chart") as HTMLCanvasElement;
        if (!canvas || typeof Chart === "undefined") return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0, // Disable animation for smoother updates
                },
                interaction: {
                    mode: "index",
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "top",
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context: any) => {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: false,
                        },
                        ticks: {
                            maxTicksLimit: 6,
                        },
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: "Usage %",
                        },
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                        },
                    },
                },
            },
        });
    }

    private updateChartData () {
        if (!this.chart) return;

        const datasets: any[] = [];
        const allTimestamps = new Set<number>();

        // Collect all unique timestamps
        for (const stats of Object.values(this.statsHistory)) {
            for (const stat of stats) {
                allTimestamps.add(stat.timestamp);
            }
        }

        // Sort timestamps
        const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

        // Format labels (time only)
        const labels = sortedTimestamps.map(ts => {
            const date = new Date(ts);
            return date.toLocaleTimeString([], {minute: "2-digit", second: "2-digit"});
        });

        // Create datasets for each job
        for (const [jobName, stats] of Object.entries(this.statsHistory)) {
            const colors = this.getJobColor(jobName);

            // Create a map for quick timestamp lookup
            const statsByTime = new Map<number, ContainerStats>();
            for (const stat of stats) {
                statsByTime.set(stat.timestamp, stat);
            }

            // CPU dataset
            const cpuData = sortedTimestamps.map(ts => {
                const stat = statsByTime.get(ts);
                return stat ? stat.cpuPercent : null;
            });

            datasets.push({
                label: `${jobName} CPU`,
                data: cpuData,
                borderColor: colors.cpu,
                backgroundColor: colors.cpu,
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 2,
            });

            // Memory dataset (dashed line)
            const memData = sortedTimestamps.map(ts => {
                const stat = statsByTime.get(ts);
                return stat ? stat.memoryPercent : null;
            });

            datasets.push({
                label: `${jobName} Mem`,
                data: memData,
                borderColor: colors.memory,
                backgroundColor: colors.memory,
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 2,
            });
        }

        // Update chart
        this.chart.data.labels = labels;
        this.chart.data.datasets = datasets;
        this.chart.update("none"); // Update without animation
    }
}

// Register custom element
customElements.define("resource-chart", ResourceChart);
