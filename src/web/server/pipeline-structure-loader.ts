import path from "path";
import fs from "fs-extra";
import yaml from "yaml";
import {Parser} from "../../parser.js";
import {Argv} from "../../argv.js";
import {WriteStreamsMock} from "../../write-streams.js";

// Reserved YAML keys that are not job definitions
const YAML_RESERVED_KEYS = new Set([
    "stages", "variables", "default", "include", "image", "services",
    "before_script", "after_script", "cache", "workflow", "pages",
    // gitlab-ci-local specific properties (CLI options that can be set in .gitlab-ci-local.yml)
    "privileged", "security-opt", "mountCache", "mountCwd", "containerExecutable",
    "shellIsolation", "shellExecutorNoImage", "forceShellExecutor",
    "umask", "userns", "device", "ulimit", "volume", "volumesFromDockerHost",
    "network", "helperImage", "defaultImage", "artifactsToSource",
    "autoMount", "cpus", "memory", "memorySwap",
]);

export interface PipelineStructure {
    exists: boolean;
    stages: string[];
    jobs: Array<{
        id: string;
        name: string;
        stage: string;
        status: string;
        needs: string[] | null;
        when: string | null;
        allowFailure: boolean;
        isManual: boolean;
        description?: string;
    }>;
    error?: string;
}

interface CachedStructure {
    structure: PipelineStructure;
    mtime: number;
}

export class PipelineStructureLoader {
    private cache: Map<string, CachedStructure> = new Map();

    async getStructure (cwd: string, stateDir: string): Promise<PipelineStructure> {
        const yamlPath = path.join(cwd, ".gitlab-ci.yml");
        const expandedPath = path.join(cwd, stateDir, "expanded-gitlab-ci.yml");

        // Check if .gitlab-ci.yml exists
        if (!fs.existsSync(yamlPath)) {
            return {
                exists: false,
                stages: [],
                jobs: [],
                error: ".gitlab-ci.yml not found",
            };
        }

        // Get modification time of source YAML
        const yamlStat = fs.statSync(yamlPath);
        const yamlMtime = yamlStat.mtimeMs;

        // Check cache
        const cached = this.cache.get(cwd);
        if (cached && cached.mtime >= yamlMtime) {
            return cached.structure;
        }

        // Try fast path: read expanded YAML if it exists and is newer
        if (fs.existsSync(expandedPath)) {
            const expandedStat = fs.statSync(expandedPath);
            if (expandedStat.mtimeMs >= yamlMtime) {
                try {
                    const structure = await this.loadFromExpanded(expandedPath);
                    this.cache.set(cwd, {structure, mtime: yamlMtime});
                    return structure;
                } catch (error) {
                    // Fall through to Parser method if expanded YAML is invalid
                    console.warn("Failed to load from expanded YAML, falling back to Parser:", error);
                }
            }
        }

        // Fallback: use Parser for full processing
        try {
            const structure = await this.loadFromParser(cwd, stateDir);
            this.cache.set(cwd, {structure, mtime: yamlMtime});
            return structure;
        } catch (error) {
            console.error("Failed to load pipeline structure:", error);
            return {
                exists: false,
                stages: [],
                jobs: [],
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    private async loadFromExpanded (expandedPath: string): Promise<PipelineStructure> {
        const content = await fs.readFile(expandedPath, "utf-8");

        // Parse with higher maxAliasCount for large pipelines with many job references
        const gitlabData = yaml.parse(content, {
            maxAliasCount: 10000, // Increase from default 100 for large pipelines
        });

        if (!gitlabData || typeof gitlabData !== "object") {
            throw new Error("Invalid expanded YAML structure");
        }

        // Extract stages
        const stages: string[] = gitlabData.stages || ["build", "test", "deploy"];

        // Extract jobs
        const jobs: PipelineStructure["jobs"] = [];

        for (const [key, value] of Object.entries(gitlabData)) {
            // Skip reserved keys and hidden jobs (starting with .)
            if (YAML_RESERVED_KEYS.has(key) || key.startsWith(".")) {
                continue;
            }

            if (typeof value !== "object" || value === null) {
                continue;
            }

            const jobDef = value as any;
            const jobStage = jobDef.stage || "test";
            const jobWhen = jobDef.when || "on_success";

            // Check if job can be manual in any circumstance
            // Check base when condition AND any rules that might have when: manual
            let isManual = jobWhen === "manual";
            if (!isManual && Array.isArray(jobDef.rules)) {
                // Check if any rule has when: manual
                isManual = jobDef.rules.some((rule: any) => rule.when === "manual");
            }

            jobs.push({
                id: `yaml-${key}`,
                name: key,
                stage: jobStage,
                status: "pending",
                needs: this.extractNeeds(jobDef.needs),
                when: jobWhen,
                allowFailure: jobDef.allow_failure || false,
                isManual: isManual,
                description: this.extractDescription(jobDef),
            });
        }

        return {
            exists: true,
            stages,
            jobs,
        };
    }

    private async loadFromParser (cwd: string, stateDir: string): Promise<PipelineStructure> {
        // Create minimal argv for Parser
        // Note: Argv.build requires relative cwd path, so we use "." and rely on process.cwd()
        const originalCwd = process.cwd();
        try {
            process.chdir(cwd);

            const argv = await Argv.build({
                cwd: ".",
                stateDir,
                file: ".gitlab-ci.yml",
                job: [],
                preview: false,
                list: false,
                listAll: false,
                listCsv: false,
                listJson: false,
                completion: false,
                shellIsolation: false,
                mountCache: true,
                variable: [],
                needs: false,
                volumesFromDockerHost: [],
                fetchIncludes: false,
                shellExecutorNoImage: false,
                containerExecutable: "docker",
                maxJobNamePadding: 0,
                umask: "0000",
            }, new WriteStreamsMock());

            const jobs: any[] = [];
            const parser = await Parser.create(argv, new WriteStreamsMock(), 0, jobs, false);

            // Extract stages (convert readonly to mutable array)
            const stages = [...parser.stages];

            // Extract jobs from parser.jobs
            const structureJobs: PipelineStructure["jobs"] = parser.jobs.map(job => {
                // Check if job can be manual in any circumstance
                let isManual = job.when === "manual";
                if (!isManual && job.rules) {
                    // Check if any rule has when: manual
                    isManual = job.rules.some(rule => rule.when === "manual");
                }

                return {
                    id: `job-${job.jobId}`,
                    name: job.name,
                    stage: job.stage,
                    status: "pending",
                    needs: job.needs?.map(n => typeof n === "string" ? n : n.job) || null,
                    when: job.when,
                    allowFailure: !!job.allowFailure,
                    isManual: isManual,
                    description: this.extractJobDescription(job),
                };
            });

            return {
                exists: true,
                stages,
                jobs: structureJobs,
            };
        } finally {
            // Restore original working directory
            process.chdir(originalCwd);
        }
    }

    private extractNeeds (needs: any): string[] | null {
        if (!Array.isArray(needs)) {
            return null;
        }

        return needs.map((n: string | {job: string}) => {
            if (typeof n === "string") {
                return n;
            }
            if (typeof n === "object" && n !== null && "job" in n) {
                return n.job;
            }
            return null;
        }).filter((n): n is string => n !== null);
    }

    private extractDescription (jobDef: any): string | undefined {
        // Check for @Description decorator (stored as gclDescription)
        if (jobDef.gclDescription && typeof jobDef.gclDescription === "string") {
            return jobDef.gclDescription;
        }

        // Check for standard description field
        if (jobDef.description && typeof jobDef.description === "string") {
            return jobDef.description;
        }

        return undefined;
    }

    private extractJobDescription (job: any): string | undefined {
        // Try to extract description from job object
        if (job.description && typeof job.description === "string") {
            return job.description;
        }

        // Check if job has gclDescription
        if (job.gclDescription && typeof job.gclDescription === "string") {
            return job.gclDescription;
        }

        return undefined;
    }

    clearCache (): void {
        this.cache.clear();
    }
}
