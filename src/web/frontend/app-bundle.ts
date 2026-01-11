/**
 * Main frontend application bundle
 * This file is bundled by esbuild and inlined into embedded.ts
 */

import {
    apiClient,
    Pipeline,
    Job,
    PipelineResponse,
    PipelineStructure,
} from "./utils/api-client.js";
import {
    formatDate,
    formatDuration,
    formatBytes,
    getStatusBadgeClass,
    getStatusIcon,
    escapeHtml,
    JOB_COLORS,
} from "./utils/format-utils.js";
import {parseAnsiColors} from "./utils/ansi-parser.js";
import {highlightYaml} from "./utils/yaml-highlighter.js";

// Declare Chart.js global (loaded from script tag)
declare const Chart: any;

// =============================================================================
// Type declarations for global window functions
// =============================================================================
declare global {
    interface Window {
        handleRunPipeline: () => Promise<void>;
        handleCancelPipeline: () => Promise<void>;
        handleRunJob: (jobId: string, jobName: string) => Promise<void>;
        handleRunJobLegacy: (jobId: string) => Promise<void>;
        handleTriggerManualJob: (jobId: string, jobName: string) => Promise<void>;
        handleRunStage: (stageName: string) => Promise<void>;
        handleLogScroll: () => void;
        showPipeline: (id: string) => void;
        showJobLogs: (id: string) => void;
        selectJob: (id: string) => Promise<void>;
        closeLogPanel: () => void;
        toggleResourceMonitor: () => void;
        toggleYamlView: (mode: "source" | "rendered") => void;
        toggleTheme: () => void;
    }
}

// =============================================================================
// State variables
// =============================================================================
let pipelineRunning = false;
let queuedJobs: Array<{id: string; name: string}> = [];

// Resource monitoring state
let resourceChart: any = null;
let resourceMonitorEnabled = localStorage.getItem("gcl-resource-monitor") !== "false";
let statsHistory: Record<string, Array<{timestamp: number; cpu: number; memoryMB: number}>> = {};
let jobColorIndex = 0;
let jobColorMap: Record<string, {cpu: string; memory: string}> = {};

// Log viewer state
let selectedJobId: string | null = null;
let logAutoScroll = true;
let renderedLogCount = 0;
let logRefreshInterval: number | null = null;
let selectJobCounter = 0;

// YAML viewer state
let yamlViewMode: "source" | "rendered" = "source";
let cachedSourceYaml: any = null;
let cachedExpandedYaml: any = null;

// Router state
let refreshInterval: number | null = null;
let routerCounter = 0;

// =============================================================================
// Theme Management
// =============================================================================
type Theme = "system" | "light" | "dark";

function getStoredTheme (): Theme {
    return (localStorage.getItem("gcl-theme") as Theme) || "system";
}

function applyTheme (theme: Theme): void {
    const root = document.documentElement;
    root.classList.remove("light-theme", "dark-theme");

    if (theme === "light") {
        root.classList.add("light-theme");
    } else if (theme === "dark") {
        root.classList.add("dark-theme");
    }
    // "system" = no class, uses prefers-color-scheme media query

    localStorage.setItem("gcl-theme", theme);
    updateThemeIcon(theme);
}

function updateThemeIcon (theme: Theme): void {
    const icon = document.getElementById("theme-icon");
    if (!icon) return;

    // Icons: sun (☀), moon (☾), auto (◐)
    if (theme === "light") {
        icon.innerHTML = "&#9788;"; // ☼ sun
        icon.title = "Light mode (click for dark)";
    } else if (theme === "dark") {
        icon.innerHTML = "&#9789;"; // ☽ moon
        icon.title = "Dark mode (click for system)";
    } else {
        icon.innerHTML = "&#9680;"; // ◐ half circle
        icon.title = "System theme (click for light)";
    }
}

function toggleTheme (): void {
    const current = getStoredTheme();
    let next: Theme;

    // Cycle: system -> light -> dark -> system
    if (current === "system") {
        next = "light";
    } else if (current === "light") {
        next = "dark";
    } else {
        next = "system";
    }

    applyTheme(next);
}

// Apply theme on script load (before DOMContentLoaded to prevent flash)
applyTheme(getStoredTheme());

// =============================================================================
// API wrapper functions (for compatibility with inline JS patterns)
// =============================================================================
async function fetchPipelines (): Promise<Pipeline[]> {
    const res = await apiClient.listPipelines();
    return res.pipelines || [];
}

async function fetchPipeline (id: string): Promise<PipelineResponse> {
    return apiClient.getPipeline(id);
}

async function fetchJobLogs (jobId: string, limit: number = 100000): Promise<{logs: any[]; total: number}> {
    return apiClient.getJobLogs(jobId, 0, limit);
}

async function fetchJobArtifacts (jobId: string): Promise<{artifacts: any[]}> {
    return apiClient.listArtifacts(jobId);
}

async function fetchJob (jobId: string): Promise<{job: Job}> {
    return apiClient.getJob(jobId);
}

async function fetchYaml (): Promise<any> {
    return apiClient.getSourceYaml();
}

async function fetchExpandedYaml (): Promise<any> {
    return apiClient.getExpandedYamlConfig();
}

async function fetchConfig (): Promise<any> {
    return apiClient.getConfig();
}

async function fetchPipelineStatus (): Promise<{running: boolean; pipelineId?: string}> {
    return apiClient.getPipelineStatus();
}

async function fetchPipelineStructure (): Promise<PipelineStructure> {
    return apiClient.getPipelineStructure();
}

async function runPipeline (jobs?: string[], manualJobs?: string[]): Promise<any> {
    return apiClient.runPipeline(jobs, manualJobs);
}

async function runSingleJob (jobId: string): Promise<any> {
    return apiClient.runJob(jobId);
}

async function cancelPipeline (): Promise<any> {
    return apiClient.cancelPipeline();
}

// =============================================================================
// Utility functions
// =============================================================================
function getJobColor (jobName: string): {cpu: string; memory: string} {
    if (!jobColorMap[jobName]) {
        jobColorMap[jobName] = JOB_COLORS[jobColorIndex % JOB_COLORS.length];
        jobColorIndex++;
    }
    return jobColorMap[jobName];
}

function updateNavbarStatus (isRunning: boolean): void {
    const navStatus = document.getElementById("nav-status");
    if (navStatus) {
        if (isRunning) {
            navStatus.innerHTML = "<div class=\"status-dot running\"></div><span>Running</span>";
        } else {
            navStatus.innerHTML = "<div class=\"status-dot idle\"></div><span>Ready</span>";
        }
    }
}

function updateNav (hash: string): void {
    document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
    if (hash === "/yaml") {
        document.getElementById("nav-yaml")?.classList.add("active");
    } else {
        document.getElementById("nav-pipelines")?.classList.add("active");
    }
}

// =============================================================================
// Manual Job Dialog functions
// =============================================================================
let manualJobDialogResolve: ((jobs: string[] | null) => void) | null = null;

function renderManualJobDialog (manualJobs: any[]): string {
    // Group by stage
    const byStage: Record<string, any[]> = {};
    manualJobs.forEach(j => {
        if (!byStage[j.stage]) byStage[j.stage] = [];
        byStage[j.stage].push(j);
    });

    let html = "<div class=\"modal-backdrop\" onclick=\"closeManualDialog()\"></div>";
    html += "<div class=\"modal-dialog manual-job-dialog\">";
    html += "<div class=\"modal-header\">";
    html += "<h3>Select Manual Jobs</h3>";
    html += "<button class=\"close-btn\" onclick=\"closeManualDialog()\">&times;</button>";
    html += "</div>";
    html += "<div class=\"modal-body\">";
    html += "<p>Select which manual jobs to run with the pipeline:</p>";

    for (const [stage, jobs] of Object.entries(byStage)) {
        html += "<div class=\"stage-group\">";
        html += "<h4>" + escapeHtml(stage) + "</h4>";
        jobs.forEach(job => {
            html += "<label class=\"manual-job-option\">";
            html += "<input type=\"checkbox\" name=\"manual-job\" value=\"" + escapeHtml(job.name) + "\" />";
            html += "<span class=\"job-name\">" + escapeHtml(job.name) + "</span>";
            if (job.description) {
                html += "<span class=\"job-description\">" + escapeHtml(job.description) + "</span>";
            }
            html += "</label>";
        });
        html += "</div>";
    }

    html += "</div>";
    html += "<div class=\"modal-footer\">";
    html += "<button onclick=\"selectAllManualJobs()\">Select All</button>";
    html += "<button onclick=\"selectNoManualJobs()\">Select None</button>";
    html += "<button class=\"btn-secondary\" onclick=\"closeManualDialog()\">Cancel</button>";
    html += "<button class=\"btn-primary\" onclick=\"confirmManualJobs()\">Run Pipeline</button>";
    html += "</div>";
    html += "</div>";

    return html;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function showManualJobDialog (manualJobs: any[]): Promise<string[] | null> {
    return new Promise(resolve => {
        manualJobDialogResolve = resolve;
        const dialogHtml = renderManualJobDialog(manualJobs);
        document.body.insertAdjacentHTML("beforeend", dialogHtml);
    });
}

function closeManualDialog (): void {
    document.querySelector(".modal-backdrop")?.remove();
    document.querySelector(".manual-job-dialog")?.remove();
    if (manualJobDialogResolve) {
        manualJobDialogResolve(null); // User cancelled
        manualJobDialogResolve = null;
    }
}

function confirmManualJobs (): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>("input[name=\"manual-job\"]:checked");
    const selected = Array.from(checkboxes).map(cb => cb.value);
    document.querySelector(".modal-backdrop")?.remove();
    document.querySelector(".manual-job-dialog")?.remove();
    if (manualJobDialogResolve) {
        manualJobDialogResolve(selected);
        manualJobDialogResolve = null;
    }
}

function selectAllManualJobs (): void {
    document.querySelectorAll<HTMLInputElement>("input[name=\"manual-job\"]")
        .forEach(cb => cb.checked = true);
}

function selectNoManualJobs (): void {
    document.querySelectorAll<HTMLInputElement>("input[name=\"manual-job\"]")
        .forEach(cb => cb.checked = false);
}

// =============================================================================
// Resource Chart functions
// =============================================================================
function toggleResourceMonitor (): void {
    resourceMonitorEnabled = !resourceMonitorEnabled;
    localStorage.setItem("gcl-resource-monitor", resourceMonitorEnabled ? "true" : "false");
    updateResourceChartVisibility();
}

function updateResourceChartVisibility (): void {
    const container = document.getElementById("resource-chart-container");
    const disabledMsg = document.getElementById("resource-disabled-msg");
    const toggleBtn = document.getElementById("resource-toggle-btn");
    if (container) container.style.display = resourceMonitorEnabled ? "block" : "none";
    if (disabledMsg) disabledMsg.style.display = resourceMonitorEnabled ? "none" : "block";
    if (toggleBtn) {
        toggleBtn.textContent = resourceMonitorEnabled ? "Disable" : "Enable";
        toggleBtn.className = "btn btn-sm resource-toggle-btn" + (resourceMonitorEnabled ? " active" : "");
    }
}

function initResourceChart (): void {
    const canvas = document.getElementById("resource-chart") as HTMLCanvasElement;
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resourceChart = new Chart(ctx, {
        type: "line",
        data: {labels: [], datasets: []},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {duration: 0},
            interaction: {mode: "index", intersect: false},
            plugins: {
                legend: {display: false},
                tooltip: {
                    callbacks: {
                        label: function (ctx: any) {
                            if (ctx.dataset.yAxisID === "y-memory") {
                                return ctx.dataset.label + ": " + (ctx.parsed.y / 1024).toFixed(2) + " GB";
                            }
                            return ctx.dataset.label + ": " + ctx.parsed.y.toFixed(1) + "%";
                        },
                    },
                },
            },
            scales: {
                x: {display: true, ticks: {maxTicksLimit: 6, font: {size: 9}}},
                "y-cpu": {
                    type: "linear",
                    display: true,
                    position: "left",
                    beginAtZero: true,
                    title: {display: true, text: "CPU %", font: {size: 9}},
                    ticks: {font: {size: 9}, callback: (v: number) => v + "%"},
                },
                "y-memory": {
                    type: "linear",
                    display: true,
                    position: "right",
                    beginAtZero: true,
                    title: {display: true, text: "Memory (GB)", font: {size: 9}},
                    ticks: {font: {size: 9}, callback: (v: number) => (v / 1024).toFixed(1) + " GB"},
                    grid: {drawOnChartArea: false},
                },
            },
        },
    });
}

function updateResourceChart (containerStats: any[]): void {
    if (!resourceMonitorEnabled || !resourceChart) return;

    const now = Date.now();
    const MB = 1024 * 1024;
    const cutoffTime = now - 120000; // 120 seconds ago

    // Add new stats to history
    if (containerStats && containerStats.length > 0) {
        containerStats.forEach((stat) => {
            if (!statsHistory[stat.jobName]) statsHistory[stat.jobName] = [];
            statsHistory[stat.jobName].push({
                timestamp: stat.timestamp || now,
                cpu: stat.cpuPercent,
                memoryMB: (stat.memoryBytes || 0) / MB,
            });
        });
    }

    // Filter out data older than 120 seconds
    Object.keys(statsHistory).forEach((jobName) => {
        statsHistory[jobName] = statsHistory[jobName].filter((h) => h.timestamp >= cutoffTime);
        if (statsHistory[jobName].length === 0) {
            delete statsHistory[jobName];
        }
    });

    // If no data, clear chart
    if (Object.keys(statsHistory).length === 0) {
        resourceChart.data.labels = [];
        resourceChart.data.datasets = [];
        resourceChart.update("none");
        return;
    }

    // Build datasets
    const allTimestamps = new Set<number>();
    Object.values(statsHistory).forEach((history) => {
        history.forEach((h) => allTimestamps.add(h.timestamp));
    });
    const sortedTs = Array.from(allTimestamps).sort((a, b) => a - b);
    const labels = sortedTs.map((ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], {minute: "2-digit", second: "2-digit"});
    });

    const datasets: any[] = [];
    Object.keys(statsHistory).forEach((jobName) => {
        const colors = getJobColor(jobName);
        const history = statsHistory[jobName];
        const historyMap: Record<number, any> = {};
        history.forEach((h) => {
            historyMap[h.timestamp] = h;
        });

        const cpuData = sortedTs.map((ts) => {
            const h = historyMap[ts];
            return h ? h.cpu : null;
        });
        const memData = sortedTs.map((ts) => {
            const h = historyMap[ts];
            return h ? h.memoryMB : null;
        });

        datasets.push({
            label: jobName + " CPU",
            data: cpuData,
            borderColor: colors.cpu,
            backgroundColor: colors.cpu,
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 2,
            yAxisID: "y-cpu",
        });
        datasets.push({
            label: jobName + " Mem",
            data: memData,
            borderColor: colors.memory,
            backgroundColor: colors.memory,
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            pointRadius: 2,
            yAxisID: "y-memory",
        });
    });

    resourceChart.data.labels = labels;
    resourceChart.data.datasets = datasets;
    resourceChart.update("none");
}

function renderResourceChart (): string {
    const displayStyle = resourceMonitorEnabled ? "block" : "none";
    const disabledStyle = resourceMonitorEnabled ? "none" : "block";
    const btnClass = "btn btn-sm resource-toggle-btn" + (resourceMonitorEnabled ? " active" : "");
    const btnText = resourceMonitorEnabled ? "Disable" : "Enable";

    return "<div class=\"card resource-chart-card\">" +
        "<div class=\"card-header\"><h3 style=\"font-size:0.9rem;margin:0\">Resource Usage</h3>" +
        "<button id=\"resource-toggle-btn\" class=\"" + btnClass + "\" onclick=\"toggleResourceMonitor()\">" + btnText + "</button></div>" +
        "<div class=\"card-body\" style=\"padding:0.5rem\">" +
        "<div id=\"resource-chart-container\" class=\"resource-chart-container\" style=\"display:" + displayStyle + "\"><canvas id=\"resource-chart\"></canvas></div>" +
        "<div id=\"resource-disabled-msg\" class=\"resource-disabled-msg\" style=\"display:" + disabledStyle + "\">Resource monitoring disabled</div>" +
        "</div></div>";
}

// =============================================================================
// DAG Visualization
// =============================================================================
function renderDagVisualization (jobs: any[], selectedId: string | null, pipelineId?: string | null, stageOrderOverride?: string[]): string {
    // Group jobs by stage
    const stageMap: Record<string, any[]> = {};
    const stageOrder: string[] = stageOrderOverride || [];

    // If no stage order provided, derive from jobs
    jobs.forEach((j) => {
        if (!stageMap[j.stage]) {
            stageMap[j.stage] = [];
            if (!stageOrderOverride) {
                stageOrder.push(j.stage);
            }
        }
        stageMap[j.stage].push(j);
    });

    // Build DAG stages HTML with circles (filter out stages with no jobs)
    const stagesHtml = stageOrder.filter((stage) => stageMap[stage] && stageMap[stage].length > 0).map((stage) => {
        const stageJobs = stageMap[stage];
        const jobsHtml = stageJobs.map((j) => {
            const needs = j.needs || [];
            const needsInfo = needs.length > 0 ? "Needs: " + needs.join(", ") : "";
            const selectedClass = selectedId === j.id ? " selected" : "";
            const manualClass = j.isManual ? " manual" : "";
            const icon = getStatusIcon(j.status);

            // For manual jobs that are pending, clicking should trigger them
            // For all other jobs, clicking just selects them
            let clickHandler;
            if (j.isManual && j.status === "pending") {
                clickHandler = `handleTriggerManualJob('${j.id}', '${escapeHtml(j.name).replace(/'/g, "\\'")}')`;
            } else if (pipelineId) {
                clickHandler = `location.hash='#/pipeline/${pipelineId}'; setTimeout(function() { selectJob('${j.id}'); }, 100);`;
            } else {
                clickHandler = `selectJob('${j.id}')`;
            }

            const manualTooltip = j.isManual && j.status === "pending" ?
                "<div class=\"dag-job-tooltip-info\">\u23F8 Manual job \u2022 Click to trigger</div>" :
                (j.isManual ? "<div class=\"dag-job-tooltip-info\">\u23F8 Manual job</div>" : "");

            return "<div class=\"dag-job status-" + j.status + selectedClass + manualClass + "\" data-job-id=\"" + j.id + "\" data-job-name=\"" + escapeHtml(j.name) + "\" data-needs=\"" + escapeHtml(needs.join(",")) + "\" onclick=\"" + clickHandler + "\">" +
                "<span class=\"dag-job-icon\">" + icon + "</span>" +
                "<div class=\"dag-job-tooltip\">" +
                "<div class=\"dag-job-tooltip-name\">" + escapeHtml(j.name) + "</div>" +
                manualTooltip +
                (j.description ? "<div class=\"dag-job-tooltip-info\">" + escapeHtml(j.description) + "</div>" : "") +
                "<div class=\"dag-job-tooltip-info\">" + j.status + (j.duration ? " \u2022 " + formatDuration(j.duration) : "") + "</div>" +
                (needsInfo ? "<div class=\"dag-job-tooltip-info\">" + needsInfo + "</div>" : "") +
                "</div></div>";
        }).join("");
        return "<div class=\"dag-stage\"><div class=\"dag-stage-header\"><span>" + escapeHtml(stage) + "</span><button class=\"run-stage-btn\" onclick=\"event.stopPropagation(); handleRunStage('" + escapeHtml(stage) + "')\" title=\"Run stage\">\u25B6</button></div><div class=\"dag-jobs\">" + jobsHtml + "</div></div>";
    }).join("");

    const legend = "<div class=\"dag-legend\">" +
        "<div class=\"dag-legend-item\"><div class=\"dag-legend-color\" style=\"border:none;background:var(--text-muted)\"></div>Pending</div>" +
        "<div class=\"dag-legend-item\"><div class=\"dag-legend-color\" style=\"border:none;background:var(--accent-color)\"></div>Running</div>" +
        "<div class=\"dag-legend-item\"><div class=\"dag-legend-color\" style=\"border:none;background:var(--success-color)\"></div>Success</div>" +
        "<div class=\"dag-legend-item\"><div class=\"dag-legend-color\" style=\"border:none;background:var(--error-color)\"></div>Failed</div>" +
        "</div>";

    return legend + "<div class=\"dag-container\"><svg class=\"dag-lines\"></svg><div class=\"dag-stages\">" + stagesHtml + "</div></div>";
}

function drawDependencyLines (): void {
    const svg = document.querySelector(".dag-lines");
    if (!svg) return;

    svg.innerHTML = "";

    // Add arrowhead marker definition
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = "<marker id=\"arrowhead\" markerWidth=\"10\" markerHeight=\"7\" refX=\"9\" refY=\"3.5\" orient=\"auto\">" +
        "<polygon points=\"0 0, 10 3.5, 0 7\" fill=\"var(--border-color)\" opacity=\"0.6\"/></marker>" +
        "<marker id=\"arrowhead-accent\" markerWidth=\"10\" markerHeight=\"7\" refX=\"9\" refY=\"3.5\" orient=\"auto\">" +
        "<polygon points=\"0 0, 10 3.5, 0 7\" fill=\"var(--accent-color)\" opacity=\"0.8\"/></marker>";
    svg.appendChild(defs);

    const container = svg.closest(".dag-container") as HTMLElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Find all jobs with needs
    const jobs = container.querySelectorAll(".dag-job");
    const jobsByName: Record<string, Element> = {};
    jobs.forEach((job) => {
        const name = job.getAttribute("data-job-name");
        if (name) {
            jobsByName[name] = job;
        }
    });

    // Draw lines for each job that has needs
    jobs.forEach((job) => {
        const needsAttr = job.getAttribute("data-needs");
        if (!needsAttr) return;

        const needs = needsAttr.split(",").filter((n) => n.trim());
        needs.forEach((needName) => {
            const sourceJob = jobsByName[needName.trim()];
            if (!sourceJob) return;

            const sourceRect = sourceJob.getBoundingClientRect();
            const targetRect = job.getBoundingClientRect();

            const sameStage = Math.abs(sourceRect.left - targetRect.left) < 50;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

            if (sameStage) {
                let x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left;
                let y1 = sourceRect.bottom - containerRect.top;
                let x2 = targetRect.left + targetRect.width / 2 - containerRect.left;
                let y2 = targetRect.top - containerRect.top;

                if (y2 < y1) {
                    const temp = y1;
                    y1 = y2;
                    y2 = temp;
                    const tempX = x1;
                    x1 = x2;
                    x2 = tempX;
                    y1 = sourceRect.top - containerRect.top;
                    y2 = targetRect.bottom - containerRect.top;
                }

                const midY = (y1 + y2) / 2;
                path.setAttribute("d", "M " + x1 + " " + y1 + " C " + x1 + " " + midY + ", " + x2 + " " + midY + ", " + x2 + " " + y2);
                path.setAttribute("class", "dag-line dag-line-same-stage");
                path.style.markerEnd = "url(#arrowhead-accent)";
            } else {
                const x1 = sourceRect.right - containerRect.left;
                const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
                const x2 = targetRect.left - containerRect.left;
                const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

                const midX = (x1 + x2) / 2;
                path.setAttribute("d", "M " + x1 + " " + y1 + " C " + midX + " " + y1 + ", " + midX + " " + y2 + ", " + x2 + " " + y2);
                path.setAttribute("class", "dag-line");
            }
            svg.appendChild(path);
        });
    });
}

function scheduleDependencyLinesDraw (): void {
    requestAnimationFrame(() => {
        setTimeout(drawDependencyLines, 50);
    });
}

// =============================================================================
// Pipeline List rendering
// =============================================================================
function buildStructureJobs (structure: PipelineStructure, recentPipelineJobs: Job[]): any[] {
    const jobStatusMap: Record<string, {status: string; duration: number | null; id: string}> = {};
    if (recentPipelineJobs && recentPipelineJobs.length > 0) {
        recentPipelineJobs.forEach((job) => {
            jobStatusMap[job.name] = {
                status: job.status,
                duration: job.duration,
                id: job.id,
            };
        });
    }
    return (structure?.jobs || []).map((j) => {
        const recentJob = jobStatusMap[j.name];
        return {
            id: recentJob ? recentJob.id : j.id,
            name: j.name,
            stage: j.stage,
            status: recentJob ? recentJob.status : "pending",
            needs: j.needs || null,
            duration: recentJob ? recentJob.duration : null,
            isManual: j.isManual || false,
            description: j.description,
        };
    });
}

function renderPipelinesSection (pipelines: Pipeline[]): string {
    if (!pipelines.length) {
        return "<div class=\"card\"><div class=\"card-header\"><h2>Recent Pipelines</h2></div>" +
            "<div class=\"empty-state\"><div class=\"empty-state-icon\">&#128203;</div><div>No pipelines run yet</div>" +
            "<div class=\"text-muted\">Click \"Run Pipeline\" above to start</div></div></div>";
    }
    const rows = pipelines.map((p) =>
        "<div class=\"pipeline-row\" onclick=\"showPipeline('" + p.id + "')\">" +
        "<div class=\"pipeline-info\"><span class=\"pipeline-id\">#" + p.iid + "</span><span class=\"" + getStatusBadgeClass(p.status) + "\">" + p.status + "</span><span class=\"pipeline-branch\">" + (p.git_ref || "") + "</span></div>" +
        "<div class=\"pipeline-time\">" + formatDate(p.created_at) + "</div></div>",
    ).join("");
    return "<div class=\"card\"><div class=\"card-header\"><h2>Recent Pipelines</h2></div><div class=\"card-body\" style=\"padding:0\">" + rows + "</div></div>";
}

function renderPipelineList (pipelines: Pipeline[], status: any, structure: PipelineStructure, recentPipelineJobs: Job[]): string {
    const isRunning = status && status.running;
    pipelineRunning = isRunning;
    updateNavbarStatus(isRunning);

    const actionBtn = "<span id=\"action-btn\">" + (isRunning ?
        "<button class=\"btn btn-danger\" onclick=\"handleCancelPipeline()\">Cancel Pipeline</button>" :
        "<button class=\"btn btn-primary\" onclick=\"handleRunPipeline()\">&#9654; Run Pipeline</button>") + "</span>";

    const recentPipelineId = pipelines.length > 0 ? pipelines[0].id : null;

    let dagSection = "";
    if (structure && structure.exists && structure.jobs && structure.jobs.length > 0) {
        const structureJobs = buildStructureJobs(structure, recentPipelineJobs);
        const dagHtml = renderDagVisualization(structureJobs, null, recentPipelineId, structure?.stages);
        dagSection = "<div class=\"card\"><div class=\"card-header\"><h2>Pipeline Structure</h2>" + actionBtn + "</div><div class=\"card-body\"><div id=\"dag-content\">" + dagHtml + "</div></div></div>";
    } else {
        dagSection = "<div class=\"card\"><div class=\"card-header\"><h2>Pipeline Structure</h2>" + actionBtn + "</div>" +
            "<div class=\"empty-state\"><div class=\"empty-state-icon\">\uD83D\uDCC4</div><div>No .gitlab-ci.yml found</div>" +
            "<div class=\"text-muted\">Create a .gitlab-ci.yml file to get started</div></div></div>";
    }

    const pipelinesSection = "<div id=\"pipelines-section\">" + renderPipelinesSection(pipelines) + "</div>";

    return dagSection + pipelinesSection;
}

function updatePipelineListContent (pipelines: Pipeline[], status: any, structure: PipelineStructure, recentPipelineJobs: Job[]): void {
    const isRunning = status && status.running;
    pipelineRunning = isRunning;
    updateNavbarStatus(isRunning);

    // Update action button
    const actionBtnEl = document.getElementById("action-btn");
    if (actionBtnEl) {
        actionBtnEl.innerHTML = isRunning ?
            "<button class=\"btn btn-danger\" onclick=\"handleCancelPipeline()\">Cancel Pipeline</button>" :
            "<button class=\"btn btn-primary\" onclick=\"handleRunPipeline()\">&#9654; Run Pipeline</button>";
    }

    // Update DAG content
    const dagContent = document.getElementById("dag-content");
    if (dagContent && structure && structure.exists && structure.jobs) {
        const recentPipelineId = pipelines.length > 0 ? pipelines[0].id : null;
        const structureJobs = buildStructureJobs(structure, recentPipelineJobs);
        const existingDagJobs = dagContent.querySelectorAll(".dag-job");

        if (existingDagJobs.length === structureJobs.length && existingDagJobs.length > 0) {
            // Update statuses in place
            structureJobs.forEach((job: any) => {
                const jobEl = dagContent.querySelector(".dag-job[data-job-name=\"" + escapeHtml(job.name) + "\"]");
                if (jobEl) {
                    const manualClass = job.isManual ? " manual" : "";
                    jobEl.className = "dag-job status-" + job.status + manualClass;
                    const iconEl = jobEl.querySelector(".dag-job-icon");
                    if (iconEl) {
                        iconEl.textContent = getStatusIcon(job.status);
                    }
                    const tooltipInfo = jobEl.querySelector(".dag-job-tooltip-info");
                    if (tooltipInfo) {
                        tooltipInfo.textContent = job.status + (job.duration ? " \u2022 " + formatDuration(job.duration) : "");
                    }
                }
            });
        } else {
            // Structure changed, do full re-render
            dagContent.innerHTML = renderDagVisualization(structureJobs, null, recentPipelineId, structure?.stages);
            scheduleDependencyLinesDraw();
        }
    }

    // Update pipelines section
    const pipelinesSection = document.getElementById("pipelines-section");
    if (pipelinesSection) {
        pipelinesSection.innerHTML = renderPipelinesSection(pipelines);
    }
}

// =============================================================================
// Pipeline Detail rendering
// =============================================================================
function renderInitProgress (p: any): string {
    if (!p.init_phase || p.status !== "queued") {
        return "";
    }
    const progress = p.init_progress || 0;
    const message = p.init_message || "Initializing...";
    return "<div class=\"init-progress\" id=\"init-progress\">" +
        "<div class=\"init-progress-header\">" +
        "<span class=\"init-progress-label\"><span class=\"init-spinner\"></span> " + escapeHtml(message) + "</span>" +
        "<span class=\"init-progress-phase\">" + progress + "%</span>" +
        "</div>" +
        "<div class=\"init-progress-bar\"><div class=\"init-progress-fill\" style=\"width: " + progress + "%\"></div></div>" +
        "</div>";
}

function renderPipelineDetail (data: PipelineResponse, selectedJob: Job | null, logData: any, structure?: PipelineStructure): string {
    const p = data.pipeline;
    const jobs = data.jobs || [];
    const dagHtml = renderDagVisualization(jobs, selectedJobId, null, structure?.stages);
    const initProgressHtml = renderInitProgress(p);

    const leftPanelClass = selectedJob ? "split-left" : "split-left full-width";
    const resourceChartHtml = renderResourceChart();
    const leftPanel = "<div class=\"" + leftPanelClass + "\">" +
        "<a href=\"#/\" class=\"back-link\">&larr; Back to pipelines</a>" +
        "<div class=\"card\"><div class=\"card-header\"><div><h2>Pipeline #" + p.iid + "</h2></div><div style=\"display:flex;gap:0.5rem;align-items:center\"><span id=\"pipeline-status\" class=\"" + getStatusBadgeClass(p.status) + "\">" + p.status + "</span>" + (p.status === "running" ? "<button class=\"btn btn-danger btn-sm\" onclick=\"handleCancelPipeline()\">Cancel</button>" : "") + "</div></div>" +
        "<div class=\"card-body\"><p>Started: " + formatDate(p.started_at) + "</p><p id=\"pipeline-duration\">Duration: " + formatDuration(p.duration) + "</p>" + initProgressHtml + "</div></div>" +
        resourceChartHtml +
        "<div class=\"card\"><div class=\"card-header\"><h2>Pipeline Graph</h2><span class=\"text-muted\">Click a job to view logs</span></div><div class=\"card-body\"><div id=\"pipeline-dag\">" + dagHtml + "</div></div></div>" +
        "</div>";

    if (selectedJob && logData) {
        const logs = logData.logs || [];
        const totalLogs = logData.total || logs.length;
        const reachedLimit = logs.length < totalLogs;
        const logCountText = logs.length + " lines" + (reachedLimit ? " (reached limit of " + logs.length + ", total: " + totalLogs + ")" : "");
        const logLines = logs.map((l: any, i: number) => {
            return "<div class=\"live-log-line\"><span class=\"live-log-line-number\">" + (i + 1) + "</span><span class=\"live-log-content\">" + parseAnsiColors(l.content) + "</span></div>";
        }).join("");

        const autoScrollClass = logAutoScroll ? " active" : "";
        const runBtnText = (selectedJob.status === "pending" || selectedJob.status === "running") ? "Run" : "Retry";
        const runBtnDisabled = pipelineRunning ? " disabled" : "";

        const rightPanel = "<div class=\"split-right\">" +
            "<div class=\"split-right-header\">" +
            "<h3 id=\"job-header\">" + escapeHtml(selectedJob.name) + " <span class=\"" + getStatusBadgeClass(selectedJob.status) + "\">" + selectedJob.status + "</span></h3>" +
            "<div class=\"header-actions\">" +
            "<button class=\"run-job-btn\" id=\"run-job-btn\" onclick=\"handleRunJob('" + selectedJob.id + "', '" + escapeHtml(selectedJob.name) + "')\"" + runBtnDisabled + ">" + runBtnText + "</button>" +
            "<button class=\"run-job-btn\" style=\"background:var(--border-color);color:white\" onclick=\"window.open('/api/jobs/" + selectedJob.id + "/logs/raw', '_blank')\">Raw</button>" +
            "<button class=\"close-btn\" onclick=\"closeLogPanel()\">\u00D7</button>" +
            "</div>" +
            "</div>" +
            "<div class=\"split-right-body\">" +
            "<div class=\"live-log-viewer\" id=\"live-log-viewer\" onscroll=\"handleLogScroll()\">" + (logLines || "<div class=\"text-muted\" style=\"padding:1rem\">No logs yet</div>") + "</div>" +
            "</div>" +
            "<div class=\"log-status-bar\">" +
            "<span id=\"log-count\">" + logCountText + "</span>" +
            "<div class=\"auto-scroll-indicator" + autoScrollClass + "\">" +
            "<span>" + (logAutoScroll ? "\u25CF Auto-scroll ON" : "\u25CB Auto-scroll OFF") + "</span>" +
            "</div>" +
            "</div>" +
            "</div>";

        setTimeout(() => {
            const container = document.querySelector(".app-main .container");
            if (container) container.classList.add("full-width");
            initSplitDivider();
        }, 0);
        return "<div class=\"split-view\">" + leftPanel + "<div class=\"split-divider\" id=\"split-divider\"></div>" + rightPanel + "</div>";
    }

    setTimeout(() => {
        const container = document.querySelector(".app-main .container");
        if (container) container.classList.remove("full-width");
    }, 0);
    return "<div class=\"split-view\">" + leftPanel + "</div>";
}

// =============================================================================
// Split View Divider
// =============================================================================
function initSplitDivider (): void {
    const divider = document.getElementById("split-divider");
    const splitView = document.querySelector(".split-view") as HTMLElement;
    const leftPanel = document.querySelector(".split-left") as HTMLElement;
    if (!divider || !splitView || !leftPanel) return;

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    divider.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;
        divider.classList.add("dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const delta = e.clientX - startX;
        let newWidth = startWidth + delta;
        const minWidth = 200;
        const maxWidth = splitView.offsetWidth - 200 - 6;
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        leftPanel.style.flex = "0 0 " + newWidth + "px";
    });

    document.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        divider.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
}

// =============================================================================
// Job Logs & Artifacts
// =============================================================================
function renderArtifacts (artifacts: any[], jobId: string): string {
    if (!artifacts || artifacts.length === 0) {
        return "<div class=\"text-muted\">No artifacts</div>";
    }
    const items = artifacts.map((a) => {
        return "<div class=\"artifact-item\">" +
            "<div class=\"artifact-info\">" +
            "<span class=\"artifact-icon\">&#128196;</span>" +
            "<span class=\"artifact-name\">" + escapeHtml(a.file_path) + "</span>" +
            "</div>" +
            "<div>" +
            "<span class=\"artifact-size\">" + formatBytes(a.size) + "</span>" +
            " <a href=\"/api/jobs/" + jobId + "/artifacts/" + encodeURIComponent(a.file_path) + "\" class=\"artifact-download\" download>Download</a>" +
            "</div>" +
            "</div>";
    }).join("");
    return "<div class=\"artifact-list\">" + items + "</div>";
}

function renderJobLogs (data: any, jobId: string, runStatus: any): string {
    const logs = data.logs || [];
    const artifacts = data.artifacts || [];
    const job = data.job || {};
    const isRunning = runStatus && runStatus.running;
    const lines = logs.map((l: any, i: number) => {
        return "<div class=\"log-line\"><span class=\"log-line-number\">" + (i + 1) + "</span><span>" + escapeHtml(l.content) + "</span></div>";
    }).join("");

    const runBtn = isRunning ?
        "<button class=\"btn btn-secondary btn-sm\" disabled>Running...</button>" :
        "<button class=\"btn btn-success btn-sm\" onclick=\"handleRunJobLegacy('" + jobId + "')\">&#9654; Run Job</button>";

    const jobInfo = job.name ? "<p><strong>Job:</strong> " + escapeHtml(job.name) + "</p>" +
        "<p><strong>Stage:</strong> " + escapeHtml(job.stage || "unknown") + "</p>" +
        "<p><strong>Status:</strong> <span class=\"" + getStatusBadgeClass(job.status) + "\">" + (job.status || "unknown") + "</span></p>" +
        (job.duration ? "<p><strong>Duration:</strong> " + formatDuration(job.duration) + "</p>" : "") : "";

    const artifactsSection = artifacts.length > 0 ?
        "<div class=\"card\"><div class=\"card-header\"><h2>Artifacts</h2><span class=\"text-muted\">" + artifacts.length + " files</span></div>" +
        "<div class=\"card-body\">" + renderArtifacts(artifacts, jobId) + "</div></div>" : "";

    return "<a href=\"javascript:history.back()\" class=\"back-link\">&larr; Back</a>" +
        (jobInfo ? "<div class=\"card\"><div class=\"card-header\"><div class=\"flex-between\" style=\"width:100%\"><h2>Job Details</h2>" + runBtn + "</div></div><div class=\"card-body\">" + jobInfo + "</div></div>" : "") +
        artifactsSection +
        "<div class=\"card\"><div class=\"card-header\"><h2>Job Logs</h2><span class=\"text-muted\">" + logs.length + " lines</span></div>" +
        "<div class=\"card-body\"><div class=\"log-viewer\">" + (lines || "<div class=\"text-muted\">No logs</div>") + "</div></div></div>";
}

// =============================================================================
// YAML View
// =============================================================================
function updateYamlView (): void {
    const sourceBtn = document.getElementById("yaml-source-btn");
    const renderedBtn = document.getElementById("yaml-rendered-btn");
    const yamlViewer = document.querySelector(".yaml-viewer");
    const lineCountSpan = document.getElementById("yaml-line-count");
    const titleSpan = document.getElementById("yaml-title");

    if (sourceBtn) sourceBtn.className = "btn" + (yamlViewMode === "source" ? " active" : "");
    if (renderedBtn) renderedBtn.className = "btn" + (yamlViewMode === "rendered" ? " active" : "");

    const data = yamlViewMode === "source" ? cachedSourceYaml : cachedExpandedYaml;
    if (yamlViewer && data) {
        if (data.exists && data.content) {
            yamlViewer.innerHTML = highlightYaml(data.content);
            if (lineCountSpan) lineCountSpan.textContent = data.content.split("\n").length + " lines";
            if (titleSpan) titleSpan.textContent = yamlViewMode === "source" ? ".gitlab-ci.yml" : "expanded-gitlab-ci.yml";
        } else {
            yamlViewer.innerHTML = "<div class=\"text-muted\" style=\"padding:1rem\">" + (data.error || "Not available") + "</div>";
            if (lineCountSpan) lineCountSpan.textContent = "";
        }
    }
}

function renderYaml (data: any, expandedData: any, config: any): string {
    cachedSourceYaml = data;
    cachedExpandedYaml = expandedData;

    if (!data.exists) {
        return "<div class=\"card\"><div class=\"empty-state\"><div class=\"empty-state-icon\">\uD83D\uDCC4</div><div>No .gitlab-ci.yml found</div><div class=\"text-muted\">Create a .gitlab-ci.yml file in the project root</div></div></div>";
    }

    const displayData = yamlViewMode === "source" ? data : (expandedData.exists ? expandedData : data);
    const highlighted = highlightYaml(displayData.content || "");
    const lineCount = (displayData.content || "").split("\n").length;
    const title = yamlViewMode === "source" ? ".gitlab-ci.yml" : "expanded-gitlab-ci.yml";

    const sourceActive = yamlViewMode === "source" ? " active" : "";
    const renderedActive = yamlViewMode === "rendered" ? " active" : "";
    const renderedDisabled = !expandedData.exists ? " disabled title=\"Run a pipeline first to generate expanded YAML\"" : "";

    return "<div class=\"card\"><div class=\"card-header\"><div><h2 id=\"yaml-title\">" + title + "</h2><div class=\"cwd-info\">" + escapeHtml(config.cwd) + "</div></div>" +
        "<div class=\"action-bar\">" +
        "<div class=\"btn-group\">" +
        "<button id=\"yaml-source-btn\" class=\"btn" + sourceActive + "\" onclick=\"toggleYamlView('source')\">Source</button>" +
        "<button id=\"yaml-rendered-btn\" class=\"btn" + renderedActive + "\"" + renderedDisabled + " onclick=\"toggleYamlView('rendered')\">Rendered</button>" +
        "</div>" +
        "<span id=\"yaml-line-count\" class=\"text-muted\">" + lineCount + " lines</span>" +
        "</div></div>" +
        "<div class=\"card-body\" style=\"padding:0\"><div class=\"yaml-viewer\">" + highlighted + "</div></div></div>";
}

// =============================================================================
// Refresh Pipeline View
// =============================================================================
async function refreshPipelineView (): Promise<void> {
    const hash = location.hash.slice(1);
    if (!hash.startsWith("/pipeline/")) return;

    const pipelineId = hash.split("/")[2];
    const [data, status, structure] = await Promise.all([fetchPipeline(pipelineId), fetchPipelineStatus(), fetchPipelineStructure()]);
    pipelineRunning = status && status.running;
    const p = data.pipeline;

    // Merge structure data (isManual, description) with actual pipeline jobs
    const enrichedJobs = (data.jobs || []).map(job => {
        const structJob = structure?.jobs?.find(sj => sj.name === job.name);
        return {
            ...job,
            isManual: structJob?.isManual || false,
            description: structJob?.description,
        };
    });
    const enrichedData = {...data, jobs: enrichedJobs};
    const jobs = enrichedJobs;

    // Check if we need a full render (structure changed)
    const logPanelExists = document.getElementById("live-log-viewer") !== null;
    const needsLogPanel = selectedJobId !== null;

    if (needsLogPanel !== logPanelExists) {
        let selectedJob: Job | null = null;
        let logData: any = null;
        if (selectedJobId) {
            selectedJob = jobs.find((j) => j.id === selectedJobId) || null;
            if (selectedJob) {
                logData = await fetchJobLogs(selectedJobId);
            }
        }
        const root = document.getElementById("app-root");
        if (root) {
            root.innerHTML = renderPipelineDetail(enrichedData, selectedJob, logData, structure);
            renderedLogCount = logData && logData.logs ? logData.logs.length : 0;
            scheduleDependencyLinesDraw();
            if (resourceChart) {
                resourceChart.destroy();
                resourceChart = null;
            }
            initResourceChart();
            if (data.resourceMonitor && data.resourceMonitor.containerStats) {
                updateResourceChart(data.resourceMonitor.containerStats);
            }
            if (logAutoScroll && selectedJobId) {
                const viewer = document.getElementById("live-log-viewer");
                if (viewer) viewer.scrollTop = viewer.scrollHeight;
            }
        }
        return;
    }

    // Targeted updates - structure unchanged
    const pipelineStatus = document.getElementById("pipeline-status");
    if (pipelineStatus) {
        pipelineStatus.className = getStatusBadgeClass(p.status);
        pipelineStatus.textContent = p.status;
        const cancelBtn = pipelineStatus.parentElement?.querySelector(".btn-danger");
        if (p.status === "running" && !cancelBtn) {
            pipelineStatus.insertAdjacentHTML("afterend", "<button class=\"btn btn-danger btn-sm\" onclick=\"handleCancelPipeline()\">Cancel</button>");
        } else if (p.status !== "running" && cancelBtn) {
            cancelBtn.remove();
        }
    }

    const pipelineDuration = document.getElementById("pipeline-duration");
    if (pipelineDuration) {
        pipelineDuration.textContent = "Duration: " + formatDuration(p.duration);
    }

    // Update DAG job statuses
    const pipelineDag = document.getElementById("pipeline-dag");
    if (pipelineDag) {
        const dagJobs = pipelineDag.querySelectorAll(".dag-job");
        const jobsChanged = dagJobs.length !== jobs.length;

        if (!jobsChanged) {
            jobs.forEach((job: any) => {
                const jobEl = pipelineDag.querySelector(".dag-job[data-job-id=\"" + job.id + "\"]");
                if (jobEl) {
                    const manualClass = job.isManual ? " manual" : "";
                    const selectedClass = job.id === selectedJobId ? " selected" : "";
                    jobEl.className = "dag-job status-" + job.status + selectedClass + manualClass;
                    const iconEl = jobEl.querySelector(".dag-job-icon");
                    if (iconEl) {
                        iconEl.textContent = getStatusIcon(job.status);
                    }
                    const tooltipInfo = jobEl.querySelector(".dag-job-tooltip-info");
                    if (tooltipInfo) {
                        tooltipInfo.textContent = job.status + (job.duration ? " \u2022 " + formatDuration(job.duration) : "");
                    }
                }
            });
        } else {
            pipelineDag.innerHTML = renderDagVisualization(jobs, selectedJobId, null, structure?.stages);
            scheduleDependencyLinesDraw();
        }
    }

    // Update logs if a job is selected
    if (selectedJobId) {
        const selectedJob = jobs.find((j) => j.id === selectedJobId);
        if (selectedJob) {
            const logData = await fetchJobLogs(selectedJobId);
            const logs = logData.logs || [];

            const selection = window.getSelection();
            const hasSelection = selection && selection.toString().length > 0;

            if (!hasSelection) {
                const jobHeader = document.getElementById("job-header");
                if (jobHeader) {
                    jobHeader.innerHTML = escapeHtml(selectedJob.name) + " <span class=\"" + getStatusBadgeClass(selectedJob.status) + "\">" + selectedJob.status + "</span>";
                }
            }

            const runBtn = document.getElementById("run-job-btn") as HTMLButtonElement;
            if (runBtn) {
                runBtn.disabled = pipelineRunning;
            }

            const viewer = document.getElementById("live-log-viewer");
            if (viewer) {
                const wasAtBottom = viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 50;

                if (!hasSelection) {
                    if (renderedLogCount === 0) {
                        if (logs.length > 0) {
                            const allHtml = logs.map((l: any, i: number) => {
                                return "<div class=\"live-log-line\"><span class=\"live-log-line-number\">" + (i + 1) + "</span><span class=\"live-log-content\">" + parseAnsiColors(l.content) + "</span></div>";
                            }).join("");
                            viewer.innerHTML = allHtml;
                        } else {
                            viewer.innerHTML = "<div class=\"text-muted\" style=\"padding:1rem\">No logs yet</div>";
                        }
                        renderedLogCount = logs.length;
                    } else if (logs.length > renderedLogCount) {
                        const newLogs = logs.slice(renderedLogCount);
                        const newHtml = newLogs.map((l: any, i: number) => {
                            const lineNum = renderedLogCount + i + 1;
                            return "<div class=\"live-log-line\"><span class=\"live-log-line-number\">" + lineNum + "</span><span class=\"live-log-content\">" + parseAnsiColors(l.content) + "</span></div>";
                        }).join("");
                        viewer.insertAdjacentHTML("beforeend", newHtml);
                        renderedLogCount = logs.length;
                    }
                }

                if (logAutoScroll && wasAtBottom && !hasSelection) {
                    viewer.scrollTop = viewer.scrollHeight;
                }
            }

            if (!hasSelection) {
                const logCount = document.getElementById("log-count");
                if (logCount) {
                    const totalLogs = logData.total || logs.length;
                    const reachedLimit = logs.length < totalLogs;
                    logCount.textContent = logs.length + " lines" + (reachedLimit ? " (reached limit of " + logs.length + ", total: " + totalLogs + ")" : "");
                }
            }
        }
    }

    // Update resource chart
    if (data.resourceMonitor && data.resourceMonitor.containerStats) {
        updateResourceChart(data.resourceMonitor.containerStats);
    }
}

// =============================================================================
// Event Handlers (exposed globally)
// =============================================================================
window.handleRunPipeline = async () => {
    try {
        // Run pipeline - manual jobs will stay pending until user clicks them
        const result = await runPipeline();

        if (result.success) {
            pipelineRunning = true;
            router();
        } else {
            alert("Failed to start pipeline: " + (result.error || "Unknown error"));
        }
    } catch (e: any) {
        console.error("Error running pipeline:", e);
        alert("Error: " + e.message);
    }
};

// Expose manual job dialog functions to window
(window as any).closeManualDialog = closeManualDialog;
(window as any).confirmManualJobs = confirmManualJobs;
(window as any).selectAllManualJobs = selectAllManualJobs;
(window as any).selectNoManualJobs = selectNoManualJobs;

window.handleCancelPipeline = async () => {
    if (!confirm("Cancel the running pipeline?")) return;
    try {
        const result = await cancelPipeline();
        if (result.success) {
            pipelineRunning = false;
            router();
        }
    } catch (e: any) {
        alert("Error: " + e.message);
    }
};

window.handleRunJob = async (jobId: string, jobName: string) => {
    const jobEl = document.querySelector(".dag-job[data-job-id=\"" + jobId + "\"]");
    if (jobEl) {
        jobEl.className = jobEl.className.replace(/status-[a-zA-Z0-9_]+/, "status-running");
        const iconEl = jobEl.querySelector(".dag-job-icon");
        if (iconEl) iconEl.textContent = "\u25C9";
        const tooltipInfo = jobEl.querySelector(".dag-job-tooltip-info");
        if (tooltipInfo) tooltipInfo.textContent = "running";
    }

    const jobHeader = document.getElementById("job-header");
    if (jobHeader && selectedJobId === jobId) {
        jobHeader.innerHTML = escapeHtml(jobName) + " <span class=\"badge badge-running\">running</span>";
    }

    const runBtn = document.getElementById("run-job-btn") as HTMLButtonElement;
    if (runBtn) runBtn.disabled = true;

    try {
        const result = await runSingleJob(jobId);
        if (result.success) {
            pipelineRunning = true;
        } else {
            alert("Failed to run job: " + (result.error || "Unknown error"));
            router();
        }
    } catch (e: any) {
        alert("Error: " + e.message);
        router();
    }
};

window.handleRunJobLegacy = async (jobId: string) => {
    try {
        const result = await runSingleJob(jobId);
        if (result.success) {
            alert("Job started: " + result.job);
            router();
        } else {
            alert("Failed to start job: " + (result.error || "Unknown error"));
        }
    } catch (e: any) {
        alert("Error: " + e.message);
    }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
window.handleTriggerManualJob = async (jobId: string, _jobName: string) => {
    try {
        // Trigger the manual job
        const result = await apiClient.runJob(jobId);

        if (result.success) {
            // Update UI to show job is running
            const jobEl = document.querySelector(`[data-job-id="${jobId}"]`);
            if (jobEl) {
                jobEl.className = jobEl.className.replace(/status-[a-zA-Z0-9_]+/, "status-running");
                const iconEl = jobEl.querySelector(".dag-job-icon");
                if (iconEl) iconEl.textContent = "\u25B6";
            }
        } else {
            alert("Failed to trigger manual job: " + (result.error || "Unknown error"));
        }
    } catch (e: any) {
        console.error("Error triggering manual job:", e);
        alert("Error: " + e.message);
    }
};

window.handleRunStage = async (stageName: string) => {
    const allJobs = document.querySelectorAll(".dag-job");
    allJobs.forEach((jobEl) => {
        const stageEl = jobEl.closest(".dag-stage");
        if (stageEl) {
            const stageHeader = stageEl.querySelector(".dag-stage-header span");
            if (stageHeader && stageHeader.textContent?.toLowerCase() === stageName.toLowerCase()) {
                const jobName = jobEl.getAttribute("data-job-name");
                const jobId = jobEl.getAttribute("data-job-id");

                if (jobName && !queuedJobs.some((j) => j.name === jobName)) {
                    queuedJobs.push({id: jobId || "", name: jobName});
                }

                jobEl.className = jobEl.className.replace(/status-[a-zA-Z0-9_]+/, "status-pending");
                const iconEl = jobEl.querySelector(".dag-job-icon");
                if (iconEl) iconEl.textContent = "\u25CE";
                const tooltipInfo = jobEl.querySelector(".dag-job-tooltip-info");
                if (tooltipInfo) tooltipInfo.textContent = "queued";
            }
        }
    });

    if (!pipelineRunning) {
        setTimeout(processJobQueue, 300);
    }
};

async function processJobQueue (): Promise<void> {
    if (pipelineRunning || queuedJobs.length === 0) return;

    const jobsToRun = queuedJobs.map((j) => j.name);
    queuedJobs = [];

    try {
        const result = await runPipeline(jobsToRun);
        if (result.success) {
            pipelineRunning = true;
            router();
        } else {
            alert("Failed to run jobs: " + (result.error || "Unknown error"));
            router();
        }
    } catch (e: any) {
        alert("Error: " + e.message);
        router();
    }
}

window.handleLogScroll = () => {
    const viewer = document.getElementById("live-log-viewer");
    if (viewer) {
        const atBottom = viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 50;
        logAutoScroll = atBottom;
    }
};

window.showPipeline = (id: string) => {
    location.hash = "/pipeline/" + id;
};

window.showJobLogs = (id: string) => {
    location.hash = "/job/" + id + "/logs";
};

window.selectJob = async (jobId: string) => {
    const thisSelection = ++selectJobCounter;

    selectedJobId = jobId;
    logAutoScroll = true;
    renderedLogCount = 0;

    if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
    }

    await refreshPipelineView();

    if (thisSelection !== selectJobCounter) return;

    logRefreshInterval = window.setInterval(async () => {
        if (selectedJobId && thisSelection === selectJobCounter) {
            await refreshPipelineView();
            if (logAutoScroll) {
                const viewer = document.getElementById("live-log-viewer");
                if (viewer) {
                    viewer.scrollTop = viewer.scrollHeight;
                }
            }
        } else if (thisSelection !== selectJobCounter) {
            clearInterval(logRefreshInterval!);
        }
    }, 1000);
};

window.closeLogPanel = () => {
    selectedJobId = null;
    renderedLogCount = 0;
    if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
    }
    refreshPipelineView();
};

window.toggleResourceMonitor = toggleResourceMonitor;
window.toggleTheme = toggleTheme;

window.toggleYamlView = (mode: "source" | "rendered") => {
    yamlViewMode = mode;
    updateYamlView();
};

// =============================================================================
// Router
// =============================================================================
async function router (): Promise<void> {
    const thisRoute = ++routerCounter;

    const root = document.getElementById("app-root");
    if (!root) return;

    const hash = location.hash.slice(1) || "/";
    updateNav(hash);
    root.innerHTML = "<div class=\"loading\"><div class=\"spinner\"></div></div>";

    // Reset container width for non-split-view pages
    const container = document.querySelector(".app-main .container");
    if (container && !hash.startsWith("/pipeline/")) {
        container.classList.remove("full-width");
    }

    // Clear auto-refresh intervals
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    try {
        if (hash === "/yaml") {
            const [data, expandedData, config] = await Promise.all([fetchYaml(), fetchExpandedYaml(), fetchConfig()]);
            root.innerHTML = renderYaml(data, expandedData, config);
        } else if (hash.startsWith("/pipeline/")) {
            const id = hash.split("/")[2];
            if (logRefreshInterval) {
                clearInterval(logRefreshInterval);
                logRefreshInterval = null;
            }
            selectedJobId = null;
            statsHistory = {};
            jobColorIndex = 0;
            jobColorMap = {};
            if (resourceChart) {
                resourceChart.destroy();
                resourceChart = null;
            }
            const [data, structure] = await Promise.all([fetchPipeline(id), fetchPipelineStructure()]);
            if (thisRoute !== routerCounter) return;

            // Merge structure data (isManual, description) with actual pipeline jobs
            const enrichedJobs = (data.jobs || []).map(job => {
                const structJob = structure?.jobs?.find(sj => sj.name === job.name);
                return {
                    ...job,
                    isManual: structJob?.isManual || false,
                    description: structJob?.description,
                };
            });
            const enrichedData = {...data, jobs: enrichedJobs};

            root.innerHTML = renderPipelineDetail(enrichedData, null, null, structure);
            scheduleDependencyLinesDraw();
            initResourceChart();
            if (data.resourceMonitor && data.resourceMonitor.containerStats) {
                updateResourceChart(data.resourceMonitor.containerStats);
            }
            refreshInterval = window.setInterval(async () => {
                try {
                    if (thisRoute !== routerCounter) {
                        clearInterval(refreshInterval!);
                        return;
                    }
                    if (!selectedJobId && location.hash.slice(1).startsWith("/pipeline/")) {
                        await refreshPipelineView();
                    }
                } catch { /* ignore */ }
            }, 2000);
        } else if (hash.startsWith("/job/") && hash.endsWith("/logs")) {
            const id = hash.split("/")[2];
            const [logsData, artifactsData, jobData, runStatus] = await Promise.all([
                fetchJobLogs(id),
                fetchJobArtifacts(id),
                fetchJob(id),
                fetchPipelineStatus(),
            ]);
            const combined = {
                logs: logsData.logs,
                artifacts: artifactsData.artifacts,
                job: jobData.job,
            };
            root.innerHTML = renderJobLogs(combined, id, runStatus);
        } else {
            const [pipelines, status, structure] = await Promise.all([fetchPipelines(), fetchPipelineStatus(), fetchPipelineStructure()]);
            if (thisRoute !== routerCounter) return;
            let recentJobs: Job[] = [];
            if (pipelines.length > 0) {
                try {
                    const recentPipeline = await fetchPipeline(pipelines[0].id);
                    recentJobs = recentPipeline.jobs || [];
                } catch { /* ignore */ }
            }
            if (thisRoute !== routerCounter) return;
            root.innerHTML = renderPipelineList(pipelines, status, structure, recentJobs);
            scheduleDependencyLinesDraw();
            refreshInterval = window.setInterval(async () => {
                try {
                    if (thisRoute !== routerCounter) {
                        clearInterval(refreshInterval!);
                        return;
                    }
                    const [newPipelines, newStatus, newStructure] = await Promise.all([fetchPipelines(), fetchPipelineStatus(), fetchPipelineStructure()]);
                    let newRecentJobs: Job[] = [];
                    if (newPipelines.length > 0) {
                        try {
                            const recentPipeline = await fetchPipeline(newPipelines[0].id);
                            newRecentJobs = recentPipeline.jobs || [];
                        } catch { /* ignore */ }
                    }
                    if (location.hash.slice(1) === "/" || location.hash === "") {
                        updatePipelineListContent(newPipelines, newStatus, newStructure, newRecentJobs);
                    }
                } catch { /* ignore */ }
            }, 2000);
        }
    } catch (e: any) {
        root.innerHTML = "<div class=\"card\"><div class=\"empty-state\"><div class=\"empty-state-icon\">&#9888;</div><div>Error loading data</div><div class=\"text-muted\">" + escapeHtml(e.message) + "</div></div></div>";
    }
}

// =============================================================================
// Initialize application
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("hashchange", router);
    updateThemeIcon(getStoredTheme()); // Update icon now that DOM is ready
    router();
});
