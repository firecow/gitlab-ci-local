import {CommandModule} from "yargs";
import * as yargs from "yargs";

import * as defaultCmd from "./commands/default_cmd"
import {Parser} from "./parser";
import * as predefinedVariables from "./predefined_variables";

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

const a = yargs
    .version("4.0.0")
    .command(defaultCmd as CommandModule)
    .option("manual", {type: "array", description: "One or more manual jobs to run during a pipeline", requiresArg: true})
    .option("list", {type: "string", description: "List jobs and job information", requiresArg: false})
    .option("cwd", {type: "string", description: "Path to a gitlab-ci.yml", requiresArg: true})
    .completion('', async (current, argv) => {
        const cwd = argv.cwd as string || process.cwd();
        const pipelineIid = predefinedVariables.getPipelineIid(cwd);
        const parser = new Parser(cwd, pipelineIid);
        return parser.getJobNames();
    })
    .argv;

process.on("uncaughtException", (err) => {
    // Handle the error safely
    process.stderr.write(`${err.stack ? err.stack : err}\n`);
    process.exit(5);
});
