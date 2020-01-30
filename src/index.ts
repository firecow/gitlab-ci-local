import * as c from "ansi-colors";
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

const makeid = (length: number): string => {
    let result = "";
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i = i + 1) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
};
process.env.CI_PIPELINE_ID = makeid(10);

const argv = yargs.argv;
const cwd = argv.cwd || process.cwd();
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
                console.log(`${c.blueBright(`${job.name}`)} skipped. when:manual`);
                continue;
            }

            if (job.isNever()) {
                console.log(`${c.blueBright(`${job.name}`)} skipped. when:never`);
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

if (["pipeline", "manual"].includes(firstArg)) {
    runJobs().catch();
} else if (firstArg === "exec") {
    runExecJobs().catch();
}
