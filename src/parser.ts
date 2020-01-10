import * as dotProp from "dot-prop";
import fs = require("fs");
import yaml = require("js-yaml");
import * as winston from "winston";
import {IKeyValue} from "./index";
import {Job} from "./job";

export class Parser {

    private readonly illigalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "include",
    ];
    private readonly gitlabData: any;

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

        const gitlabData = {...gitlabCiData, ...gitlabLocalData};
        this.gitlabData.variables = {...globalVariables, ...globalLocalVariables};

        console.log(this.gitlabData);

        this.jobs = this.createJobs(gitlabData, cwd);
    }

    private createJobs(gitlabData: any, cwd: any): Job[] {
        const variables = gitlabData.variables;

        for (const [key, value] of Object.entries(gitlabData)) {
            if (this.illigalJobNames.includes(key) || key[0] === ".") {
                continue;
            }

            const job = new Job(value, key, cwd, variables);
            addToMaps(key, job);
        }

        return jobs;
    }

}
