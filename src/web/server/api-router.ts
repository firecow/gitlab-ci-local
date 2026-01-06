import http from "http";
import path from "path";
import fs from "fs-extra";
import {spawn} from "child_process";
import yaml from "yaml";
import {GCLDatabase} from "../persistence/database.js";
import {LogFileManager, LogLine} from "../persistence/log-file-manager.js";
import {ContainerStats} from "../../resource-monitor.js";
import {Utils} from "../../utils.js";
import {matchContainerId} from "../utils/docker-utils.js";

interface RouteParams {
    [key: string]: string;
}

type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) => Promise<void> | void;

interface Route {
    method: string;
    pattern: RegExp;
    paramNames: string[];
    handler: RouteHandler;
}

export class APIRouter {
    // Reserved YAML keys that are not job definitions
    private static readonly YAML_RESERVED_KEYS = new Set([
        "stages", "variables", "default", "include", "image", "services",
        "before_script", "after_script", "cache", "workflow", "pages",
    ]);

    private routes: Route[] = [];
    private db: GCLDatabase;
    private logFileManager: LogFileManager | null;
    private cwd: string;
    private stateDir: string;
    private mountCwd: boolean;
    private volumes: string[];
    private helperImage?: string;
    private urlBase: string;
    private runningProcess: ReturnType<typeof spawn> | null = null;
    private containerExecutable: string;
    private resourceMonitorEnabled: boolean = true; // Toggle state for the UI

    constructor (db: GCLDatabase, cwd: string, stateDir: string, mountCwd?: boolean, volumes?: string[], helperImage?: string, logFileManager?: LogFileManager, webBaseUrl?: string, containerExecutable?: string) {
        this.db = db;
        this.logFileManager = logFileManager || null;
        this.cwd = cwd;
        this.stateDir = stateDir;
        this.mountCwd = mountCwd ?? false;
        this.volumes = volumes ?? [];
        this.helperImage = helperImage;
        this.urlBase = webBaseUrl || "http://localhost";
        this.containerExecutable = containerExecutable || "docker";
        this.registerRoutes();
    }

    private registerRoutes () {
        // Pipeline routes
        this.get("/api/pipelines", this.listPipelines.bind(this));
        this.post("/api/pipelines/run", this.runPipeline.bind(this));
        this.get("/api/pipelines/status", this.getPipelineRunStatus.bind(this));
        this.post("/api/pipelines/cancel", this.cancelPipeline.bind(this));
        this.get("/api/pipelines/:id", this.getPipeline.bind(this));
        this.get("/api/pipelines/:id/jobs", this.listJobs.bind(this));
        this.get("/api/pipelines/:id/yaml", this.getExpandedYaml.bind(this));

        // Job routes
        this.get("/api/jobs/:id", this.getJob.bind(this));
        this.get("/api/jobs/:id/logs", this.getJobLogs.bind(this));
        this.get("/api/jobs/:id/logs/raw", this.getJobLogsRaw.bind(this));
        this.post("/api/jobs/:id/run", this.runJob.bind(this));

        // Stage routes
        this.post("/api/stages/:name/run", this.runStage.bind(this));

        // Artifact routes
        this.get("/api/jobs/:id/artifacts", this.listArtifacts.bind(this));
        this.get("/api/jobs/:id/artifacts/*", this.downloadArtifact.bind(this));

        // Stats route
        this.get("/api/stats", this.getStats.bind(this));

        // Resource monitoring routes
        this.get("/api/resource-monitor/status", this.getResourceMonitorStatus.bind(this));
        this.post("/api/resource-monitor/enable", this.enableResourceMonitor.bind(this));
        this.post("/api/resource-monitor/disable", this.disableResourceMonitor.bind(this));

        // Config routes
        this.get("/api/config", this.getConfig.bind(this));
        this.get("/api/config/yaml", this.getGitlabCiYaml.bind(this));
        this.get("/api/config/expanded-yaml", this.getExpandedGitlabCiYaml.bind(this));

        // Pipeline structure (parsed from YAML)
        this.get("/api/pipeline-structure", this.getPipelineStructure.bind(this));
    }

    private get (pattern: string, handler: RouteHandler) {
        this.addRoute("GET", pattern, handler);
    }

    private post (pattern: string, handler: RouteHandler) {
        this.addRoute("POST", pattern, handler);
    }

    private addRoute (method: string, pattern: string, handler: RouteHandler) {
        // Convert route pattern to regex and extract param names
        const paramNames: string[] = [];
        const regexPattern = pattern
            .replace(/\*/g, ".*")
            .replace(/:(\w+)/g, (_, name) => {
                paramNames.push(name);
                return "([^/]+)";
            });

        this.routes.push({
            method,
            pattern: new RegExp(`^${regexPattern}$`),
            paramNames,
            handler,
        });
    }

    async handle (req: http.IncomingMessage, res: http.ServerResponse) {
        const route = this.matchRoute(req.method!, req.url!);
        if (!route) {
            this.notFound(res);
            return;
        }

        try {
            await route.handler(req, res, route.params);
        } catch (error) {
            console.error("API error:", error);
            this.serverError(res, error instanceof Error ? error.message : "Internal server error");
        }
    }

    private matchRoute (method: string, urlPath: string): {handler: RouteHandler; params: RouteParams} | null {
        const parsedUrl = new URL(urlPath, this.urlBase);
        const pathname = parsedUrl.pathname || "/";

        for (const route of this.routes) {
            if (route.method !== method) continue;

            const match = pathname.match(route.pattern);
            if (match) {
                const params: RouteParams = {};
                route.paramNames.forEach((name, i) => {
                    params[name] = match[i + 1];
                });
                return {handler: route.handler, params};
            }
        }

        return null;
    }

    // Reload database if a pipeline is running (to pick up subprocess changes)
    private async reloadIfRunning () {
        if (this.runningProcess) {
            await this.db.reload();
        }
    }

    // Build base command arguments for spawning gitlab-ci-local
    private buildBaseArgs (): string[] {
        const args = ["--state-dir", this.stateDir];
        if (this.mountCwd) {
            args.push("--mount-cwd");
        }
        for (const vol of this.volumes) {
            args.push("--volume", vol);
        }
        if (this.helperImage) {
            args.push("--helper-image", this.helperImage);
        }
        return args;
    }

    // Build spawn command (determines dev vs production mode)
    private buildSpawnCommand (args: string[]): {cmd: string; cmdArgs: string[]} {
        const nodeExecutable = process.argv[0];
        const mainScript = process.argv[1];

        if (mainScript.includes("tsx") || mainScript.endsWith(".ts")) {
            // Development mode - use tsx
            return {
                cmd: "npx",
                cmdArgs: ["tsx", path.join(this.cwd, "src/index.ts"), ...args],
            };
        } else {
            // Production mode - use the same executable
            return {
                cmd: nodeExecutable,
                cmdArgs: [mainScript, ...args],
            };
        }
    }

    // Attach event handlers to a spawned process
    private attachProcessHandlers (label: string): void {
        if (!this.runningProcess) return;

        this.runningProcess.on("close", async (code) => {
            console.log(`${label} process exited with code ${code}`);
            this.runningProcess = null;
            // Reload database to pick up final state from subprocess
            await this.db.reload();
        });

        this.runningProcess.on("error", (err) => {
            console.error(`${label} process error:`, err);
            this.runningProcess = null;
        });

        this.runningProcess.stdout?.on("data", (data) => {
            process.stdout.write(`[${label.toLowerCase()}] ${data}`);
        });

        this.runningProcess.stderr?.on("data", (data) => {
            process.stderr.write(`[${label.toLowerCase()}] ${data}`);
        });
    }

    // Parse memory string like "1.5GiB" or "500MiB" to bytes
    private parseMemoryToBytes (memStr: string): number {
        const match = memStr.match(/^([\d.]+)\s*([A-Za-z]+)/);
        if (!match) return 0;
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const multipliers: Record<string, number> = {
            "b": 1,
            "kib": 1024,
            "kb": 1000,
            "mib": 1024 * 1024,
            "mb": 1000 * 1000,
            "gib": 1024 * 1024 * 1024,
            "gb": 1000 * 1000 * 1000,
        };
        return value * (multipliers[unit] || 1);
    }

    // Poll docker stats for running containers using JSON format
    private async pollDockerStats (containerIds: string[], jobNames: Map<string, string>): Promise<ContainerStats[]> {
        if (containerIds.length === 0) return [];

        try {
            // Use JSON format for reliable parsing
            const cmd = `${this.containerExecutable} stats --no-stream --format json ${containerIds.join(" ")}`;

            const {stdout} = await Utils.bash(cmd, this.cwd);
            const stats: ContainerStats[] = [];
            const now = Date.now();

            // Parse JSON output (one JSON object per line)
            const lines = stdout.trim().split("\n").filter(l => l.length > 0);
            for (const line of lines) {
                try {
                    const stat = JSON.parse(line);
                    const containerId = stat.Container || stat.ID || "";
                    const cpuStr = (stat.CPUPerc || "0%").replace("%", "");
                    // MemUsage format: "1.5GiB / 8GiB" - take the first part (used)
                    const memUsage = stat.MemUsage || "0B / 0B";
                    const memUsageParts = memUsage.split("/");
                    const memUsedStr = memUsageParts[0].trim();

                    const cpu = parseFloat(cpuStr) || 0;
                    const memoryBytes = this.parseMemoryToBytes(memUsedStr);

                    // Find matching container (docker stats may return short ID)
                    let jobName = "unknown";
                    for (const [fullId, name] of jobNames) {
                        if (matchContainerId(fullId, containerId)) {
                            jobName = name;
                            break;
                        }
                    }

                    stats.push({
                        containerId: containerId.substring(0, 12),
                        jobName,
                        cpuPercent: cpu,
                        memoryPercent: 0, // Keep for backwards compatibility
                        memoryBytes,
                        timestamp: now,
                    });
                } catch {
                    // Skip lines that aren't valid JSON (e.g., warnings)
                }
            }

            return stats;
        } catch {
            return [];
        }
    }

    // Pipeline handlers
    private async listPipelines (req: http.IncomingMessage, res: http.ServerResponse) {
        await this.reloadIfRunning();

        const parsedUrl = new URL(req.url!, this.urlBase);
        const limit = parseInt(parsedUrl.searchParams.get("limit") || "20");
        const offset = parseInt(parsedUrl.searchParams.get("offset") || "0");

        const pipelines = this.db.getRecentPipelines(limit, offset);
        this.json(res, {pipelines});
    }

    // Safely parse needs JSON, returning null if invalid or not an array
    private parseNeeds (needsJson: string | null): string[] | null {
        if (!needsJson) return null;
        try {
            const parsed = JSON.parse(needsJson);
            // Ensure we always return an array or null
            if (Array.isArray(parsed)) {
                return parsed;
            }
            // If it's a single string, wrap in array
            if (typeof parsed === "string") {
                return [parsed];
            }
            return null;
        } catch {
            // Invalid JSON - might be a plain string, wrap in array
            return [needsJson];
        }
    }

    private async getPipeline (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        await this.reloadIfRunning();

        const pipeline = this.db.getPipeline(params.id);
        if (!pipeline) {
            this.notFound(res, "Pipeline not found");
            return;
        }

        const jobs = this.db.getJobsByPipeline(params.id).map(job => ({
            ...job,
            needs: this.parseNeeds(job.needs),
        }));

        // Collect container IDs from running jobs for live stats
        let containerStats: ContainerStats[] = [];
        const statsHistory: Record<string, ContainerStats[]> = {};

        if (this.resourceMonitorEnabled) {
            const containerIds: string[] = [];
            const jobNames = new Map<string, string>();

            for (const job of jobs) {
                if (job.status === "running" && job.container_id) {
                    containerIds.push(job.container_id);
                    jobNames.set(job.container_id, job.name);
                }
            }

            // Poll live stats if there are running containers
            if (containerIds.length > 0) {
                containerStats = await this.pollDockerStats(containerIds, jobNames);
            }
        }

        this.json(res, {
            pipeline,
            jobs,
            resourceMonitor: {
                enabled: this.resourceMonitorEnabled,
                containerStats,
                statsHistory,
            },
        });
    }

    private async listJobs (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        const jobs = this.db.getJobsByPipeline(params.id).map(job => ({
            ...job,
            needs: this.parseNeeds(job.needs),
        }));
        this.json(res, {jobs});
    }

    private async getExpandedYaml (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        const pipeline = this.db.getPipeline(params.id);
        if (!pipeline) {
            this.notFound(res, "Pipeline not found");
            return;
        }

        const yamlPath = path.join(this.cwd, this.stateDir, "expanded-gitlab-ci.yml");
        try {
            const yaml = await fs.readFile(yamlPath, "utf-8");
            this.json(res, {yaml});
        } catch {
            this.notFound(res, "Expanded YAML not found");
        }
    }

    // Job handlers
    private async getJob (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        await this.reloadIfRunning();

        const job = this.db.getJob(params.id);
        if (!job) {
            this.notFound(res, "Job not found");
            return;
        }

        this.json(res, {job: {
            ...job,
            needs: this.parseNeeds(job.needs),
        }});
    }

    private async getJobLogs (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        await this.reloadIfRunning();

        const parsedUrl = new URL(req.url!, this.urlBase);
        const offset = parseInt(parsedUrl.searchParams.get("offset") || "0");
        const limit = parseInt(parsedUrl.searchParams.get("limit") || "1000");

        // Try file-based logs first (preferred for memory efficiency)
        if (this.logFileManager) {
            const job = this.db.getJob(params.id);
            if (job) {
                const logs = await this.logFileManager.getJobLogs(job.pipeline_id, params.id, offset, limit);
                const total = await this.logFileManager.getJobLogCount(job.pipeline_id, params.id);
                this.json(res, {logs: logs.map((l: LogLine) => ({
                    line_number: l.lineNumber,
                    stream: l.stream,
                    content: l.content,
                    timestamp: l.timestamp,
                })), total});
                return;
            }
        }

        // Fallback to database logs
        const logs = this.db.getJobLogs(params.id, offset, limit);
        const total = this.db.getJobLogCount(params.id);

        this.json(res, {logs, total});
    }

    private async getJobLogsRaw (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        await this.reloadIfRunning();

        const job = this.db.getJob(params.id);
        if (!job) {
            this.notFound(res, "Job not found");
            return;
        }

        // Try file-based logs first using LogFileManager for consistent path handling
        if (this.logFileManager) {
            try {
                // Use LogFileManager to get logs and convert to plain text
                const logs = await this.logFileManager.getJobLogs(job.pipeline_id, params.id, 0, 100000);
                if (logs.length > 0) {
                    res.writeHead(200, {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "no-cache",
                    });

                    for (const log of logs) {
                        res.write((log.content ?? "") + "\n");
                    }

                    res.end();
                    return;
                }
            } catch (error) {
                // Log error but continue to database fallback
                console.error("Error reading file-based logs:", error);
            }
        }

        // Fallback to database logs
        const logs = this.db.getJobLogs(params.id, 0, 100000); // Get all logs
        res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
        });

        for (const log of logs) {
            res.write((log.content ?? "") + "\n");
        }
        res.end();
    }

    // Artifact handlers
    private async listArtifacts (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        await this.reloadIfRunning();
        const artifacts = this.db.getArtifactsByJob(params.id);
        this.json(res, {artifacts});
    }

    private async downloadArtifact (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        const job = this.db.getJob(params.id);
        if (!job) {
            this.notFound(res, "Job not found");
            return;
        }

        // Extract file path from URL
        const urlPath = new URL(req.url!, this.urlBase).pathname;
        const artifactPath = urlPath.replace(`/api/jobs/${params.id}/artifacts/`, "");

        // Prevent path traversal
        if (artifactPath.includes("..")) {
            this.forbidden(res, "Invalid path");
            return;
        }

        const fullPath = path.join(this.cwd, this.stateDir, "artifacts", job.name, artifactPath);

        try {
            const stat = await fs.stat(fullPath);
            if (!stat.isFile()) {
                this.notFound(res, "File not found");
                return;
            }

            // Send file
            res.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Content-Length": stat.size,
                "Content-Disposition": `attachment; filename="${path.basename(artifactPath)}"`,
            });

            const stream = fs.createReadStream(fullPath);
            stream.pipe(res);
        } catch {
            this.notFound(res, "File not found");
        }
    }

    // Stats handler
    private async getStats (req: http.IncomingMessage, res: http.ServerResponse) {
        const stats = this.db.getStats();
        this.json(res, stats);
    }

    // Resource monitor handlers
    private async getResourceMonitorStatus (req: http.IncomingMessage, res: http.ServerResponse) {
        this.json(res, {
            enabled: this.resourceMonitorEnabled,
        });
    }

    private async enableResourceMonitor (req: http.IncomingMessage, res: http.ServerResponse) {
        this.resourceMonitorEnabled = true;
        this.json(res, {success: true, enabled: true});
    }

    private async disableResourceMonitor (req: http.IncomingMessage, res: http.ServerResponse) {
        this.resourceMonitorEnabled = false;
        this.json(res, {success: true, enabled: false});
    }

    // Config handlers
    private async getConfig (req: http.IncomingMessage, res: http.ServerResponse) {
        const config = {
            cwd: this.cwd,
            stateDir: this.stateDir,
            gitlabCiFile: ".gitlab-ci.yml",
        };

        // Check if .gitlab-ci.yml exists
        const yamlPath = path.join(this.cwd, ".gitlab-ci.yml");
        config.gitlabCiFile = await fs.pathExists(yamlPath) ? ".gitlab-ci.yml" : null as any;

        this.json(res, config);
    }

    private async getGitlabCiYaml (req: http.IncomingMessage, res: http.ServerResponse) {
        const yamlPath = path.join(this.cwd, ".gitlab-ci.yml");

        try {
            const content = await fs.readFile(yamlPath, "utf-8");
            this.json(res, {
                file: ".gitlab-ci.yml",
                content,
                exists: true,
            });
        } catch {
            this.json(res, {
                file: ".gitlab-ci.yml",
                content: null,
                exists: false,
                error: "File not found",
            });
        }
    }

    private async getExpandedGitlabCiYaml (req: http.IncomingMessage, res: http.ServerResponse) {
        const expandedPath = path.join(this.cwd, this.stateDir, "expanded-gitlab-ci.yml");

        try {
            const content = await fs.readFile(expandedPath, "utf-8");
            this.json(res, {
                file: "expanded-gitlab-ci.yml",
                content,
                exists: true,
            });
        } catch {
            this.json(res, {
                file: "expanded-gitlab-ci.yml",
                content: null,
                exists: false,
                error: "Expanded YAML not found. Run a pipeline first to generate it.",
            });
        }
    }

    private async getPipelineStructure (req: http.IncomingMessage, res: http.ServerResponse) {
        const yamlPath = path.join(this.cwd, ".gitlab-ci.yml");

        try {
            const content = await fs.readFile(yamlPath, "utf-8");
            const parsed = yaml.parse(content);

            // Extract stages (use default if not specified)
            // GitLab CI always has .pre and .post stages available
            const userStages: string[] = parsed.stages || ["build", "test", "deploy"];

            // Extract jobs
            const jobs: Array<{
                id: string;
                name: string;
                stage: string;
                status: string;
                needs: string[] | null;
                when: string | null;
                allowFailure: boolean;
            }> = [];

            // Track which stages have jobs
            const usedStages = new Set<string>();

            for (const [key, value] of Object.entries(parsed)) {
                // Skip reserved keys and hidden jobs (starting with .)
                if (APIRouter.YAML_RESERVED_KEYS.has(key) || key.startsWith(".") || typeof value !== "object" || value === null) {
                    continue;
                }

                const jobDef = value as Record<string, any>;
                const jobStage = jobDef.stage || "test";
                usedStages.add(jobStage);

                // Extract needs - can be array of strings or array of objects with 'job' property
                let needs: string[] | null = null;
                if (Array.isArray(jobDef.needs)) {
                    needs = jobDef.needs.map((n: string | {job: string}) => {
                        if (typeof n === "string") return n;
                        if (typeof n === "object" && n.job) return n.job;
                        return null;
                    }).filter((n): n is string => n !== null);
                }

                jobs.push({
                    id: `yaml-${key}`,
                    name: key,
                    stage: jobStage,
                    status: "pending",
                    needs,
                    when: jobDef.when || null,
                    allowFailure: jobDef.allow_failure || false,
                });
            }

            // Build final stages list: .pre first, user stages, .post last
            // Only include .pre/.post if they have jobs or are explicitly in stages list
            const stages: string[] = [];

            // Add .pre if it has jobs or is explicitly listed
            if (usedStages.has(".pre") || userStages.includes(".pre")) {
                stages.push(".pre");
            }

            // Add user stages (excluding .pre and .post which we handle specially)
            for (const stage of userStages) {
                if (stage !== ".pre" && stage !== ".post") {
                    stages.push(stage);
                }
            }

            // Add .post if it has jobs or is explicitly listed
            if (usedStages.has(".post") || userStages.includes(".post")) {
                stages.push(".post");
            }

            // Sort jobs by stage order (.pre = -1, .post = Infinity, others by position)
            const stageOrder = new Map<string, number>();
            stageOrder.set(".pre", -1);
            stages.forEach((s, i) => {
                if (s !== ".pre" && s !== ".post") {
                    stageOrder.set(s, i);
                }
            });
            stageOrder.set(".post", Infinity);

            jobs.sort((a, b) => {
                const aOrder = stageOrder.get(a.stage) ?? 999;
                const bOrder = stageOrder.get(b.stage) ?? 999;
                return aOrder - bOrder;
            });

            this.json(res, {
                exists: true,
                stages,
                jobs,
            });
        } catch (error) {
            this.json(res, {
                exists: false,
                stages: [],
                jobs: [],
                error: error instanceof Error ? error.message : "Failed to parse YAML",
            });
        }
    }

    // Create pending pipeline and jobs from YAML before subprocess starts
    private async createPendingPipeline (requestedJobs: string[]): Promise<string> {
        const yamlPath = path.join(this.cwd, ".gitlab-ci.yml");

        // Get next pipeline IID from database (ensures uniqueness)
        const pipelineIid = this.db.getNextPipelineIid();

        // Generate unique pipeline ID using timestamp + iid
        const pipelineId = `${Date.now()}-${pipelineIid}`;

        // Create pipeline entry
        this.db.createPipeline({
            id: pipelineId,
            iid: pipelineIid,
            status: "queued",
            started_at: null,
            finished_at: null,
            duration: null,
            cwd: this.cwd,
            git_ref: null,
            git_sha: null,
        });

        // Parse YAML to get jobs
        try {
            const content = await fs.readFile(yamlPath, "utf-8");
            const parsed = yaml.parse(content);

            let jobIndex = 0;
            for (const [key, value] of Object.entries(parsed)) {
                if (APIRouter.YAML_RESERVED_KEYS.has(key) || key.startsWith(".") || typeof value !== "object" || value === null) {
                    continue;
                }

                // If specific jobs requested, only include those
                if (requestedJobs.length > 0 && !requestedJobs.includes(key)) {
                    continue;
                }

                const jobDef = value as Record<string, unknown>;

                // Extract needs
                let needs: string[] | null = null;
                if (Array.isArray(jobDef.needs)) {
                    needs = (jobDef.needs as Array<string | {job: string}>).map(n => {
                        if (typeof n === "string") return n;
                        if (typeof n === "object" && n.job) return n.job;
                        return null;
                    }).filter((n): n is string => n !== null);
                }

                const jobId = `${pipelineIid}-${jobIndex++}`;
                this.db.createJob({
                    id: jobId,
                    pipeline_id: pipelineId,
                    name: key,
                    base_name: key,
                    stage: (jobDef.stage as string) || "test",
                    status: "pending",
                    when_condition: (jobDef.when as string) || null,
                    allow_failure: jobDef.allow_failure ? 1 : 0,
                    needs: needs ? JSON.stringify(needs) : null,
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
            }
        } catch (e) {
            console.error("Error parsing YAML for pending jobs:", e);
        }

        return pipelineId;
    }

    // Pipeline execution handlers
    private async runPipeline (req: http.IncomingMessage, res: http.ServerResponse) {
        if (this.runningProcess) {
            this.json(res, {error: "A pipeline is already running", running: true}, 409);
            return;
        }

        // Parse request body for optional job names
        let body = "";
        req.on("data", chunk => body += chunk);
        await new Promise<void>(resolve => req.on("end", resolve));

        let requestedJobs: string[] = [];
        if (body) {
            try {
                const data = JSON.parse(body);
                requestedJobs = data.jobs || [];
            } catch {
                // Ignore parse errors, run full pipeline
            }
        }

        // Create pipeline entry immediately with pending status
        const pipelineId = await this.createPendingPipeline(requestedJobs);

        // Build command arguments
        const args = this.buildBaseArgs();
        if (requestedJobs.length > 0) {
            args.push(...requestedJobs);
        }

        const {cmd, cmdArgs} = this.buildSpawnCommand(args);

        // Get the pipeline IID from the pending pipeline we just created
        const pendingPipeline = this.db.getPipeline(pipelineId);
        const pipelineIid = pendingPipeline?.iid ?? 0;

        try {
            this.runningProcess = spawn(cmd, cmdArgs, {
                cwd: this.cwd,
                env: {
                    ...process.env,
                    GCIL_WEB_UI_ENABLED: "true",
                    GCIL_PIPELINE_IID: String(pipelineIid),
                    FORCE_COLOR: "0",
                },
                stdio: ["ignore", "pipe", "pipe"],
            });

            const pid = this.runningProcess.pid;
            this.attachProcessHandlers("Pipeline");

            this.json(res, {
                success: true,
                message: "Pipeline started",
                pid,
                pipelineId,
                jobs: requestedJobs.length > 0 ? requestedJobs : "all",
            });
        } catch (error) {
            this.runningProcess = null;
            this.serverError(res, error instanceof Error ? error.message : "Failed to start pipeline");
        }
    }

    private async getPipelineRunStatus (req: http.IncomingMessage, res: http.ServerResponse) {
        this.json(res, {
            running: this.runningProcess !== null,
            pid: this.runningProcess?.pid || null,
        });
    }

    private async cancelPipeline (req: http.IncomingMessage, res: http.ServerResponse) {
        if (!this.runningProcess) {
            this.json(res, {error: "No pipeline is running", running: false}, 404);
            return;
        }

        try {
            this.runningProcess.kill("SIGINT");
            this.json(res, {success: true, message: "Pipeline cancellation requested"});
        } catch (error) {
            this.serverError(res, error instanceof Error ? error.message : "Failed to cancel pipeline");
        }
    }

    private async runJob (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        if (this.runningProcess) {
            this.json(res, {error: "A pipeline is already running", running: true}, 409);
            return;
        }

        const job = this.db.getJob(params.id);
        if (!job) {
            this.notFound(res, "Job not found");
            return;
        }

        // Build command to run specific job
        const args = this.buildBaseArgs();
        args.push(job.name);

        const {cmd, cmdArgs} = this.buildSpawnCommand(args);

        try {
            this.runningProcess = spawn(cmd, cmdArgs, {
                cwd: this.cwd,
                env: {
                    ...process.env,
                    GCIL_WEB_UI_ENABLED: "true",
                    FORCE_COLOR: "0",
                },
                stdio: ["ignore", "pipe", "pipe"],
            });

            const pid = this.runningProcess.pid;
            this.attachProcessHandlers("Job");

            this.json(res, {
                success: true,
                message: `Job "${job.name}" started`,
                pid,
                job: job.name,
            });
        } catch (error) {
            this.runningProcess = null;
            this.serverError(res, error instanceof Error ? error.message : "Failed to start job");
        }
    }

    private async runStage (req: http.IncomingMessage, res: http.ServerResponse, params: RouteParams) {
        if (this.runningProcess) {
            this.json(res, {error: "A pipeline is already running", running: true}, 409);
            return;
        }

        const stageName = decodeURIComponent(params.name);

        // Build command to run specific stage using --stage option
        const args = this.buildBaseArgs();
        args.push("--stage", stageName);

        const {cmd, cmdArgs} = this.buildSpawnCommand(args);

        try {
            this.runningProcess = spawn(cmd, cmdArgs, {
                cwd: this.cwd,
                env: {
                    ...process.env,
                    GCIL_WEB_UI_ENABLED: "true",
                    FORCE_COLOR: "0",
                },
                stdio: ["ignore", "pipe", "pipe"],
            });

            const pid = this.runningProcess.pid;
            this.attachProcessHandlers("Stage");

            this.json(res, {
                success: true,
                message: `Stage "${stageName}" started`,
                pid,
                stage: stageName,
            });
        } catch (error) {
            this.runningProcess = null;
            this.serverError(res, error instanceof Error ? error.message : "Failed to start stage");
        }
    }

    // Response helpers
    private json (res: http.ServerResponse, data: any, statusCode: number = 200) {
        res.writeHead(statusCode, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(data));
    }

    private notFound (res: http.ServerResponse, message: string = "Not found") {
        this.json(res, {error: message}, 404);
    }

    private forbidden (res: http.ServerResponse, message: string = "Forbidden") {
        this.json(res, {error: message}, 403);
    }

    private serverError (res: http.ServerResponse, message: string = "Internal server error") {
        this.json(res, {error: message}, 500);
    }
}
