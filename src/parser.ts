import c = require("ansi-colors");
import deepExtend  = require("deep-extend");
import fs = require("fs");
import yaml = require("js-yaml");
import * as winston from "winston";
import {Job} from "./job";
import {Stage} from "./stage";

export class Parser {

    private readonly illigalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "include",
    ];
    private readonly jobs: Map<string, Job> = new Map();
    private readonly stages: Map<string, Stage> = new Map();

    constructor(cwd: any, logger: winston.Logger) {
        // Fail if .gitlab-ci.yml missing
        const gitlabCiYmlPath = `${cwd}/.gitlab-ci.yml`;
        if (!fs.existsSync(gitlabCiYmlPath)) {
            logger.error(`Could not find ${gitlabCiYmlPath}`);
            process.exit(1);
        }

        // Fail if .gitlab-ci.local.yml missing
        const gitlabCiLocalYmlPath = `${cwd}/.gitlab-ci.local.yml`;
        if (!fs.existsSync(gitlabCiLocalYmlPath)) {
            logger.error(`Could not find ${gitlabCiLocalYmlPath}`);
            process.exit(1);
        }

        const orderedVariables = [];
        const orderedYml = [];

        // Parse .gitlab-ci.yml
        orderedYml.push(yaml.safeLoad(fs.readFileSync(gitlabCiYmlPath, "utf8")));
        orderedVariables.push(orderedYml[orderedYml.length - 1].variables || {});

        // Parse .gitlab-ci.local.yml
        orderedYml.push(yaml.safeLoad(fs.readFileSync(gitlabCiLocalYmlPath, "utf8")));
        orderedVariables.push(orderedYml[orderedYml.length - 1].variables || {});

        // Parse yamls included by other ci files.
        const includes = deepExtend.apply(this, orderedYml).include || [];
        for (const value of includes) {
            if (!value.local) {
                continue;
            }

            orderedYml.unshift(yaml.safeLoad(fs.readFileSync(`${cwd}/${value.local}`, "utf8")));
            orderedVariables.unshift(orderedYml[0].variables || {});
        }

        // Setup variables and "merged" yml
        const gitlabData = deepExtend.apply(this, orderedYml);

        // Generate stages
        for (const value of gitlabData.stages) {
            this.stages.set(value, new Stage(value));
        }

        // Generate jobs and put them into stages
        for (const [key, value] of Object.entries(gitlabData)) {
            if (this.illigalJobNames.includes(key) || key[0] === ".") {
                continue;
            }

            const job = new Job(value, key, cwd, gitlabData);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                console.error(`${c.blueBright(`${job.name}`)} ${c.yellow(`${job.stage}`)} ${c.red(`isn't specified in stages. Must be one of the following`)} ${c.yellow(`${stagesJoin}`)}`);
                process.exit(1);
            }

            this.jobs.set(key, job);
        }
    }

    public getStages(): ReadonlyMap<string, Stage> {
        return this.stages;
    }

    public getJobs(): ReadonlyMap<string, Job> {
        return this.jobs;
    }
}
