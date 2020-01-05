import c = require("ansi-colors");
import * as dotProp from "dot-prop";
import fs = require("fs");
import * as winston from "winston";
import yaml = require("yaml");
import yargs = require("yargs");
import {Job} from "./job";

const colorizer = winston.format.colorize();

const logger: winston.Logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({format: "HH:mm:SS"}),
        winston.format.printf((m) => colorizer.colorize(m.level, `${m.timestamp}: ${m.message}`)),

    ),
    level: "info",
    transports: [
        new winston.transports.Console(),
    ],
});

const illigalJobName = ["image", "services", "stages", "types", "before_script", "default", "after_script", "variables", "cache", "include"];
const argv = yargs.argv;
const cwd = argv.cwd || process.cwd();

// Parse .gitlab-ci.yml
const gitlabCiYmlPath = `${cwd}/.gitlab-ci.yml`;
if (!fs.existsSync(gitlabCiYmlPath)) {
    logger.error(`Could not find ${gitlabCiYmlPath}`);
    process.exit(1);
}
const gitlabCiContent = fs.readFileSync(gitlabCiYmlPath, "utf8");
const gitlabCiData = yaml.parse(gitlabCiContent);

// Parse .gitlab-local.yml
const gitlabCiLocalYmlPath = `${cwd}/.gitlab-local.yml`;
if (!fs.existsSync(gitlabCiLocalYmlPath)) {
    logger.error(`Could not find ${gitlabCiLocalYmlPath}`);
    process.exit(1);
}
const gitlabCiLocalContent = fs.readFileSync(gitlabCiLocalYmlPath, "utf8");
const gitlabLocalData = yaml.parse(gitlabCiLocalContent);

const jobs = new Map<string, Job>();
const stages = new Map<string, any[]>();

export interface IKeyValue {
    [key: string]: string | undefined;
}

const globalVariables = dotProp.get<IKeyValue>(gitlabCiData, "variables") || {};
const globalLocalVariables = dotProp.get<IKeyValue>(gitlabLocalData, "variables") || {};

for (const value of gitlabCiData.stages) {
    stages.set(value, []);
}

const addToMaps = (key: string, job: Job) => {
    const stage = stages.get(job.stage);
    if (stage) {
        stage.push(job);
    } else {
        console.error(`${c.yellow(`${job.stage}`)} ${c.red(`isn't specified in stages:`)}`);
        process.exit(1);
    }

    jobs.set(key, job);
};

for (const [key, value] of Object.entries(gitlabCiData)) {
    if (illigalJobName.includes(key)) {
        continue;
    }

    const job = new Job(value, key, cwd, {...globalVariables, ...globalLocalVariables});
    addToMaps(key, job);
}

for (const [key, value] of Object.entries(gitlabLocalData)) {
    if (illigalJobName.includes(key)) {
        continue;
    }

    let job = jobs.get(key);
    if (job) {
        job.override(value);
    } else {
        job = new Job(value, key, cwd, {...globalVariables, ...globalLocalVariables});
        addToMaps(key, job);
    }
}

const runJobs = async () => {

    for (const [stageName, jobs] of stages) {
        const promises: Array<Promise<any>> = [];
        console.log(`========> ${c.yellow(`${stageName}`)}`);

        const jobNames = jobs.join(", ");

        console.log(`Starting ${c.blueBright(`${jobNames}`)}...`);
        for (const job of jobs) {
            const jobPromise = job.start();
            promises.push(jobPromise);
        }

        await Promise.all(promises);
    }
    process.exit(1);
};

runJobs().then(() => {
    console.log("Ok!");
}).catch(() => {
    console.error("Error!");
});
