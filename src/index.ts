import c = require("ansi-colors");
import * as winston from "winston";
import yargs = require("yargs");
import {Job} from "./job";
import {Parser} from "./parser";

export interface IKeyValue {
     [key: string]: string | undefined;
}

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

const argv = yargs.argv;
const cwd = argv.cwd || process.cwd();

const parser = new Parser(cwd, logger);
//
// console.log(gitlabData);
process.exit(0);

// const jobs = new Map<string, Job>();
// const stages = new Map<string, Job[]>();
//
// export interface IKeyValue {
//     [key: string]: string | undefined;
// }
//
// for (const value of gitlabCiData.stages) {
//     stages.set(value, []);
// }
//
// const addToMaps = (key: string, job: Job) => {
//     const stage = stages.get(job.stage);
//     if (stage) {
//         stage.push(job);
//     } else {
//         const stagesJoin = Array.from(stages.keys()).join(", ");
//         console.error(`${c.blueBright(`${job.name}`)} ${c.yellow(`${job.stage}`)} ${c.red(`isn't specified in stages. Must be one of the following`)} ${c.yellow(`${stagesJoin}`)}`);
//         process.exit(1);
//     }
//
//     jobs.set(key, job);
// };
//
// for (const [key, value] of Object.entries(gitlabCiData)) {
//     if (illigalJobName.includes(key) || key[0] === ".") {
//         continue;
//     }
//
//     const job = new Job(value, key, cwd, {...globalVariables, ...globalLocalVariables});
//     addToMaps(key, job);
// }
//
// const runJobs = async () => {
//
//     for (const [stageName, jobList] of stages) {
//         const promises: Array<Promise<any>> = [];
//
//         if (jobList.length === 0) {
//             console.log(`=> ${c.yellow(`${stageName}`)} has no jobs`);
//             console.log("");
//             continue;
//         }
//
//         if (jobList.length === 0) {
//             continue;
//         }
//
//         const jobNames = `${jobList.join(" ")}`;
//         console.log(`=> ${c.yellow(`${stageName}`)} > ${c.blueBright(`${jobNames}`)} ${c.magentaBright(`starting`)}...`);
//         for (const job of jobList) {
//             const jobPromise = job.start();
//             promises.push(jobPromise);
//         }
//
//         try {
//             await Promise.all(promises);
//             console.log("");
//         } catch (e) {
//             if (e !== "") { console.error(e); }
//             process.exit(1);
//         }
//     }
// };
//
// process.on("uncaughtException", (err) => {
//     // handle the error safely
//     console.log(err);
// });
//
// runJobs().catch();
