import c = require("ansi-colors");
import * as winston from "winston";
import yargs = require("yargs");
import {Parser} from "./parser";

const colorizer = winston.format.colorize();

// Array polyfill
declare global {
    // tslint:disable-next-line:interface-name
    interface Array<T> {
        last(): T | undefined;
        first(): T | undefined;
    }
}
Array.prototype.last = function() {
    return this[this.length - 1];
};
Array.prototype.first = function() {
    return this[0];
};

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

const argv = yargs.argv;
const cwd = argv.cwd || process.cwd();

const parser = new Parser(cwd, logger);

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
        console.log(`=> ${c.yellow(`${stageName}`)} > ${c.blueBright(`${jobNames}`)} ${c.magentaBright(`starting`)}...`);
        for (const job of jobs) {
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

process.on("uncaughtException", (err) => {
    // handle the error safely
    console.log(err);
});

runJobs().catch();
