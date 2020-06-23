import * as c from "ansi-colors";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "yaml";

import { execSync } from "child_process";
import * as predefinedVariables from "./predefined_variables";
import { Job } from "./job";
import { Stage } from "./stage";

export class Parser {

    public static loadYaml(filePath: string): any {
        const gitlabCiLocalYmlPath = `${filePath}`;
        if (!fs.existsSync(gitlabCiLocalYmlPath)) {
            return {};
        }

        return yaml.parse(fs.readFileSync(`${filePath}`, "utf8")) || {};
    }

    private readonly illigalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "include",
    ];
    private readonly jobs: Map<string, Job> = new Map();

    public readonly maxJobNameLength: number = 0;
    private readonly stages: Map<string, Stage> = new Map();
    private readonly cwd: string;

    public constructor(cwd: any, pipelineIid: number) {
        let path = '';
        let yamlDataList: any[] = [];

        this.cwd = cwd;

        path = `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = Parser.loadYaml(path);
        yamlDataList = yamlDataList.concat(this.prepareIncludes(gitlabCiData));

        path = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = Parser.loadYaml(path);
        yamlDataList = yamlDataList.concat(this.prepareIncludes(gitlabCiLocalData));

        // Setup variables and "merged" yml
        const gitlabData = deepExtend.apply(this, yamlDataList);

        // Generate stages. We'll do our best to replicate what the
        // gitlab-org runner does.

        // If there's no stages defined by the user, the following stages
        // must be defined. Please see:
        // https://docs.gitlab.com/ee/ci/yaml/#stages
        if (!gitlabData.stages) {
            gitlabData.stages = ["build", "test", "deploy"];
        }

        // ".pre" and ".post" are always present. See:
        // https://docs.gitlab.com/ee/ci/yaml/#pre-and-post
        gitlabData.stages.unshift(".pre");
        gitlabData.stages.push(".post");

        for (const value of gitlabData.stages || []) {
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

            const jobId = predefinedVariables.getJobId(cwd);
            const job = new Job(value, key, gitlabData.stages, cwd, gitlabData, pipelineIid, jobId, this.maxJobNameLength);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                process.stderr.write(`${c.blueBright(`${job.name}`)} uses ${c.yellow(`stage:${job.stage}`)}. Stage cannot be found in [${c.yellow(`${stagesJoin}`)}]\n`);
                process.exit(1);
            }
            predefinedVariables.incrementJobId(cwd);

            this.jobs.set(key, job);
        }
    }

    private prepareIncludes(doc: any): any[] {
        let includeDatas: any[] = [];
        const cwd = this.cwd;

        for (const value of doc["include"] || []) {
            if (value["local"]) {
                const localDoc = Parser.loadYaml(`${this.cwd}/${value.local}`);
                includeDatas = includeDatas.concat(this.prepareIncludes(localDoc));
            } else if (value["file"]) {
                const ref = value["ref"] || "master";
                const file = value["file"];
                const project = value["project"];
                const gitlabCiLocalPath = `${cwd}/.gitlab-ci-local/includes/${project}/${ref}/`;

                const domainRegExp = /^.*@(.*):.*\(fetch\)/;
                const output = execSync(`git remote -v`, {
                    cwd: `${this.cwd}`
                });
                const exec = domainRegExp.exec(`${output}`);
                const gitDomain = exec ? exec[1] : null;
                fs.ensureDirSync(gitlabCiLocalPath);
                execSync(`git archive --remote=git@${gitDomain}:${project}.git ${ref} --format=zip ${file} | gunzip -c - > ${file}`, {
                    cwd: gitlabCiLocalPath
                });

                const fileDoc = Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/${file}`);
                includeDatas = includeDatas.concat(this.prepareIncludes(fileDoc));

            } else {
                process.stderr.write(`Didn't understand include ${JSON.stringify(value)}\n`);
            }
        }

        includeDatas.push(doc);
        return includeDatas;
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

    public getJobNames(): ReadonlyArray<string> {
        return Array.from(this.jobs.keys());
    }

    public getStageNames(): ReadonlyArray<string> {
        return Array.from(this.stages.values()).map((s) => s.name);
    }

    public getStages(): ReadonlyArray<Stage> {
        return Array.from(this.stages.values());
    }

    public validateNeedsTags() {
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
