import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as yargs from "yargs";

import { Commander } from "./commander";
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

const argv = yargs
    .version("3.0.7")
    .option("manual", {type: "array", description: "One or more manual jobs to run during a pipeline", requiresArg: true})
    .option("list", {type: "string", description: "List jobs and job information", requiresArg: false})
    .option("cwd", {type: "string", description: "Path to a gitlab-ci.yml", requiresArg: true})
    .argv;

// const argv: any = yargs.argv;
// const cwd = argv.cwd || process.cwd();
// const parser = new Parser(cwd);

// Ensure gitlab-ci-local working directory and assets.
// const pipelinesStatePath = `${cwd}/.gitlab-ci-local/state.yml`;
// fs.ensureFileSync(pipelinesStatePath);
// let pipelinesState: any = yaml.safeLoad(fs.readFileSync(pipelinesStatePath, "utf8"));
// if (!pipelinesState) {
//     pipelinesState = {};
// }
// pipelinesState.pipelineId = pipelinesState.pipelineId !== undefined ? Number(pipelinesState.pipelineId) : 0;
// fs.writeFileSync(pipelinesStatePath, yaml.safeDump(pipelinesState), {});
// process.env.CI_PIPELINE_ID = pipelinesState.pipelineId;
//
// if (argv.list === "") {
//     Commander.runList(parser);
//     process.exit(0);
// } else if (argv._.length === 0) {
//     (async () => {
//         // Increment with one, since this is a "new" pipeline
//         pipelinesState.pipelineId += 1;
//         fs.writeFileSync(pipelinesStatePath, yaml.safeDump(pipelinesState), {});
//         process.env.CI_PIPELINE_ID = pipelinesState.pipelineId;
//
//         // Run pipeline
//         await Commander.runPipeline(parser, argv.manual || []);
//         process.exit(0);
//     })();
// } else if (argv._.length === 1) {
//     (async () => {
//         // Run single job
//         await Commander.runSingleJob(parser, argv._[0]);
//     })();
// }

process.on("uncaughtException", (err) => {
    // Handle the error safely
    process.stderr.write(`${err}\n`);
    process.exit(5);
});
