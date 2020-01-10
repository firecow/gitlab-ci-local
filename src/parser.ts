import c = require("ansi-colors");
import * as dotProp from "dot-prop";
import fs = require("fs");
import yaml = require("js-yaml");
import merge = require("lodash.merge");
import * as winston from "winston";
import {IKeyValue} from "./index";
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
        // Parse .gitlab-ci.yml
        const gitlabCiYmlPath = `${cwd}/.gitlab-ci.yml`;
        if (!fs.existsSync(gitlabCiYmlPath)) {
            logger.error(`Could not find ${gitlabCiYmlPath}`);
            process.exit(1);
        }
        const gitlabCiContent = fs.readFileSync(gitlabCiYmlPath, "utf8");
        const gitlabCiData = yaml.safeLoad(gitlabCiContent);
        const globalVariables = dotProp.get<IKeyValue>(gitlabCiData, "variables") || {};

        // Parse .gitlab-local.yml
        const gitlabCiLocalYmlPath = `${cwd}/.gitlab-ci.local.yml`;
        if (!fs.existsSync(gitlabCiLocalYmlPath)) {
            logger.error(`Could not find ${gitlabCiLocalYmlPath}`);
            process.exit(1);
        }
        const gitlabCiLocalContent = fs.readFileSync(gitlabCiLocalYmlPath, "utf8");
        const gitlabLocalData = yaml.safeLoad(gitlabCiLocalContent);
        const globalLocalVariables = dotProp.get<IKeyValue>(gitlabLocalData, "variables") || {};

        const gitlabData = merge(gitlabCiData, gitlabLocalData);
        gitlabData.variables = {...globalVariables, ...globalLocalVariables};

        for (const value of gitlabCiData.stages) {
            this.stages.set(value, new Stage(value));
        }

        // Generate all jobs specified in final gitlabData
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
