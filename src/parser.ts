import * as c from "ansi-colors";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";

import { Job } from "./job";
import { Stage } from "./stage";

export class Parser {

    private static loadYaml(filePath: string): any {
        const gitlabCiLocalYmlPath = `${filePath}`;
        if (!fs.existsSync(gitlabCiLocalYmlPath)) {
            return {};
        }

        return yaml.safeLoad(fs.readFileSync(`${filePath}`, "utf8"));
    }

    private readonly illigalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "include",
    ];
    private readonly jobs: Map<string, Job> = new Map();

    public readonly maxJobNameLength: number = 0;
    private readonly stages: Map<string, Stage> = new Map();

    public constructor(cwd: any) {

        const orderedVariables = [];
        const orderedYml = [];

        // Add .gitlab-ci.yml
        let path = `${cwd}/.gitlab-ci.yml`;
        if (!fs.existsSync(path)) { // Fail if empty
            process.stderr.write(`${cwd}/.gitlab-ci.yml is not found\n`);
            process.exit(1);
        }
        orderedYml.push(Parser.loadYaml(`${cwd}/.gitlab-ci.yml`));
        orderedVariables.push(orderedYml.last().variables);

        // Add .gitlab-ci-local.yml
        path = `${cwd}/.gitlab-ci-local.yml`;
        orderedYml.push(Parser.loadYaml(path));
        orderedVariables.push(orderedYml.last().variables || {});
        if (!orderedYml.last() || Object.keys(orderedYml.last()).length === 0) { // Warn if empty
            process.stderr.write(`WARN: ${cwd}/.gitlab-ci-local.yml is empty or not found\n`);
        }

        // Add included yaml's.
        orderedYml.unshift({});
        const includes = deepExtend.apply(this, orderedYml).include || [];
        for (const value of includes) {
            if (!value.local) {
                continue;
            }

            orderedYml.unshift(Parser.loadYaml(`${cwd}/${value.local}`));
            orderedVariables.unshift(orderedYml.first().variables || {});
        }

        // Setup variables and "merged" yml
        orderedYml.unshift({});
        const gitlabData = deepExtend.apply(this, orderedYml);

        // 'stages' missing, throw error
        if (!gitlabData.stages) {
            process.stderr.write(`${c.red("'stages' tag is missing")}\n`);
            process.exit(1);
        }

        // Generate stages
        for (const value of gitlabData.stages) {
            this.stages.set(value, new Stage(value));
        }

        // Find longest job name
        for (const key of Object.keys(gitlabData)) {
            if (this.illigalJobNames.includes(key) || key[0] === ".") {
                continue;
            }
            this.maxJobNameLength = Math.max(this.maxJobNameLength, key.length);
        }

        // Generate jobs and put them into stages
        for (const [key, value] of Object.entries(gitlabData)) {
            if (this.illigalJobNames.includes(key) || key[0] === ".") {
                continue;
            }

            const job = new Job(value, key, gitlabData.stages, cwd, gitlabData, this.maxJobNameLength);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                process.stderr.write(`${c.blueBright(`${job.name}`)} uses ${c.yellow(`stage:${job.stage}`)}. Stage cannot be found in [${c.yellow(`${stagesJoin}`)}]\n`);
                process.exit(1);
            }

            this.jobs.set(key, job);
        }

        this.validateNeedsTags();
    }

    public getJobByName(name: string): Job {
        const job = this.jobs.get(name);
        if (!job) {
            process.stderr.write(`${c.blueBright(`${name}`)} ${c.red(" could not be found")}\n`);
            process.exit(1);
        }

        return job;
    }

    public getJobs(): ReadonlyArray<Job> {
        return Array.from(this.jobs.values());
    }

    public getStageNames(): ReadonlyArray<string> {
        return Array.from(this.stages.values()).map((s) => s.name);
    }

    public getStages(): ReadonlyArray<Stage> {
        return Array.from(this.stages.values());
    }

    private validateNeedsTags() {
        const jobNames = Array.from(this.jobs.values()).map((j) => j.name);
        for (const job of this.jobs.values()) {
            if (job.needs === null || job.needs.length === 0) {
                continue;
            }

            if (job.needs.filter((v) => (jobNames.indexOf(v) >= 0)).length !== job.needs.length) {
                process.stderr.write(`${c.blueBright(`${job.name}`)} needs list contains unspecified jobs.\n`);
                process.exit(1);
            }

            for (const need of job.needs) {
                const needJob = this.jobs.get(need);
                if (needJob && needJob.stageIndex >= job.stageIndex) {
                    process.stderr.write(`${c.blueBright(`${job.name}`)} cannot need a job from same or future stage. need: ${c.blueBright(`${needJob.name}`)}\n`);
                    process.exit(1);
                }
            }

        }
    }
}
