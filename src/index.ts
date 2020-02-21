import * as c from "ansi-colors";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as yargs from "yargs";

import { Parser } from "./parser";

// Array polyfill
declare global {
    // tslint:disable-next-line:interface-name
    interface Array<T> {
        first(): T | undefined;
        last(): T | undefined;
    }
}
Array.prototype.last = function() {
    return this[this.length - 1];
};
Array.prototype.first = function() {
    return this[0];
};

const argv = yargs.argv;
const cwd = String(argv.cwd || process.cwd());
const m: any = argv.m;
const manualArgs: string[] = [].concat(m || []);

const firstArg = argv._[0] ?? "pipeline";

if (firstArg === "manual") {
    for (let i = 1; i < argv._.length; i += 1) {
        manualArgs.push(argv._[i]);
    }
}

const parser = new Parser(cwd);

const runJobs = async () => {
    const stages = parser.getStages();
    for (const [stageName, stage] of stages) {
        const promises: Array<Promise<any>> = [];
        const jobs = stage.getJobs();

        if (stage.getJobs().length === 0) {
            console.log(`=> ${c.yellow(`${stageName}`)} has no jobs`);
            console.log("");
            continue;
        }

        const jobNames = `${jobs.map((j) => j.name).join(" ")}`;
        console.log(`=> ${c.yellow(`${stageName}`)} > ${c.blueBright(`${jobNames}`)} ${c.magentaBright("starting")}...`);
        for (const job of jobs) {
            if (job.isManual() && !manualArgs.includes(job.name)) {
                console.log(`${job.getJobNameString()} skipped. when:manual`);
                continue;
            }

            if (job.isNever()) {
                console.log(`${job.getJobNameString()} skipped. when:never`);
                continue;
            }

            const jobPromise = job.start();
            promises.push(jobPromise);
        }

        try {
            await Promise.all(promises);
            console.log("");
        } catch (e) {
            if (e !== "") {
                console.error(e);
            }
            process.exit(1);
        }
    }
};

const runExecJobs = async () => {
    const promises: Array<Promise<any>> = [];
    for (let i = 1; i < argv._.length; i += 1) {
        const jobName = argv._[i];
        const job = parser.getJobs().get(argv._[i]);
        if (!job) {
            console.error(`${c.blueBright(`${jobName}`)} ${c.red(" could not be found")}`);
            process.exit(1);
        }

        const jobPromise = job.start();
        promises.push(jobPromise);
    }

    try {
        await Promise.all(promises);
        console.log("");
    } catch (e) {
        if (e !== "") {
            console.error(e);
        }
        process.exit(1);
    }
};

process.on("uncaughtException", (err) => {
    // Handle the error safely
    console.log(err);
});

// Ensure gitlab-ci-local working directory and assets.
const pipelinesStatePath = `${cwd}/.gitlab-ci-local/state.yml`;
fs.ensureFileSync(pipelinesStatePath);
let pipelinesState: any = yaml.safeLoad(fs.readFileSync(pipelinesStatePath, "utf8"));
if (!pipelinesState) {
    pipelinesState = {};
}
pipelinesState.pipelineId = pipelinesState.pipelineId !== undefined ? Number(pipelinesState.pipelineId) : 0;
console.log(firstArg);
if (["pipeline", "manual"].includes(firstArg)) {
    pipelinesState.pipelineId += 1;
}
fs.writeFileSync(pipelinesStatePath, yaml.safeDump(pipelinesState), {});
process.env.CI_PIPELINE_ID = pipelinesState.pipelineId;

if (["pipeline", "manual"].includes(firstArg)) {
    runJobs().catch();
} else if (firstArg === "exec") {
    runExecJobs().catch();
}
