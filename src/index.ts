import c = require("ansi-colors");
import * as dotProp from "dot-prop";
import fs = require("fs");
import * as winston from "winston";
import yaml = require("js-yaml");
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

const illigalJobName = ["local_configuration", "image", "services", "stages", "pages", "types", "before_script", "default", "after_script", "variables", "cache", "include"];
const argv = yargs.argv;
const cwd = argv.cwd || process.cwd();

// Parse .gitlab-ci.yml
const gitlabCiYmlPath = `${cwd}/.gitlab-ci.yml`;
if (!fs.existsSync(gitlabCiYmlPath)) {
    logger.error(`Could not find ${gitlabCiYmlPath}`);
    process.exit(1);
}
const gitlabCiContent = fs.readFileSync(gitlabCiYmlPath, "utf8");
const gitlabCiData = yaml.safeLoad(gitlabCiContent);

// Parse .gitlab-local.yml
const gitlabCiLocalYmlPath = `${cwd}/.gitlab-ci.local.yml`;
if (!fs.existsSync(gitlabCiLocalYmlPath)) {
    logger.error(`Could not find ${gitlabCiLocalYmlPath}`);
    process.exit(1);
}
const gitlabCiLocalContent = fs.readFileSync(gitlabCiLocalYmlPath, "utf8");
const gitlabLocalData = yaml.safeLoad(gitlabCiLocalContent);

const jobs = new Map<string, Job>();
const stages = new Map<string, Job[]>();

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
        const stagesJoin = Array.from(stages.keys()).join(", ");
        console.error(`${c.blueBright(`${job.name}`)} ${c.yellow(`${job.stage}`)} ${c.red(`isn't specified in stages. Must be one of the following`)} ${c.yellow(`${stagesJoin}`)}`);
        process.exit(1);
    }

    jobs.set(key, job);
};

for (const [key, value] of Object.entries(gitlabCiData)) {
    if (illigalJobName.includes(key) || key[0] === ".") {
        continue;
    }

    const job = new Job(value, key, cwd, {...globalVariables, ...globalLocalVariables});
    addToMaps(key, job);
}

for (const [key, value] of Object.entries(gitlabLocalData || {})) {
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

    for (const [stageName, jobList] of stages) {
        const promises: Array<Promise<any>> = [];

        if (jobList.length === 0) {
            console.log(`=> ${c.yellow(`${stageName}`)} has no jobs`);
            console.log("");
            continue;
        }

        if (jobList.length === 0) {
            continue;
        }

        const jobNames = `${jobList.join(" ")}`;
        console.log(`=> ${c.yellow(`${stageName}`)} > ${c.blueBright(`${jobNames}`)} ${c.magentaBright(`starting`)}...`);
        for (const job of jobList) {
            const jobPromise = job.start();
            promises.push(jobPromise);
        }

        try {
            await Promise.all(promises);
            console.log("");
        } catch (e) {
            if (e !== "") { console.error(e); }
            process.exit(1);
        }
    }
};

process.on("uncaughtException", (err) => {
    // handle the error safely
    console.log(err);
});

runJobs().catch();
