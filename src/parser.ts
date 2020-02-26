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

    private readonly maxJobNameLength: number = 0;
    private readonly stages: Map<string, Stage> = new Map();

    public constructor(cwd: any) {

        const orderedVariables = [];
        const orderedYml = [];

        // Add .gitlab-ci.yml
        let path = `${cwd}/.gitlab-ci.yml`;
        if (!fs.existsSync(path)) { // Fail if empty
            console.error(`${cwd}/.gitlab-ci.yml is not found`);
            process.exit(1);
        }
        orderedYml.push(Parser.loadYaml(`${cwd}/.gitlab-ci.yml`));
        orderedVariables.push(orderedYml.last().variables);

        // Add .gitlab-ci-local.yml
        path = `${cwd}/.gitlab-ci-local.yml`;
        orderedYml.push(Parser.loadYaml(path));
        orderedVariables.push(orderedYml.last().variables || {});
        if (!orderedYml.last() || Object.keys(orderedYml.last()).length === 0) { // Warn if empty
            console.error(`WARN: ${cwd}/.gitlab-ci-local.yml is empty or not found`);
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
            console.error(`${c.red("'stages' tag is missing")}`);
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

            const job = new Job(value, key, cwd, gitlabData, this.maxJobNameLength);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                console.error(`${c.blueBright(`${job.name}`)} ${c.yellow(`${job.stage}`)} ${c.red("isn't specified in stages. Must be one of the following")} ${c.yellow(`${stagesJoin}`)}`);
                process.exit(1);
            }

            this.jobs.set(key, job);
        }
    }

    public getJobs(): ReadonlyMap<string, Job> {
        return this.jobs;
    }

    public getStages(): ReadonlyMap<string, Stage> {
        return this.stages;
    }
}
