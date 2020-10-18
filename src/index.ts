import * as yargs from "yargs";
import {CommandModule} from "yargs";
import * as defaultCmd from "./default_cmd";

import {Parser} from "./parser";
import * as predefinedVariables from "./predefined_variables";

process.on('uncaughtException', (err) => {
    process.stderr.write(`${err.stack ? err.stack : err}\n`);
    process.exit(5);
});
process.on('unhandledRejection', (reason) => {
    process.stderr.write(`${reason}\n`);
    process.exit(5);
});

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
    .version("4.2.2")
    .showHelpOnFail(false)
    .wrap(180)
    .command(defaultCmd as CommandModule)
    .usage("Find more information at https://github.com/firecow/gitlab-ci-local")
    .option("manual", {type: "array", description: "One or more manual jobs to run during a pipeline", requiresArg: true})
    .option("list", {type: "string", description: "List jobs and job information", requiresArg: false})
    .option("cwd", {type: "string", description: "Path to a gitlab-ci.yml", requiresArg: true})
    .option("completion", {type: "string", description: "Generate bash completion script", requiresArg: false})
    .option("needs", {type: "boolean", description: "Run needed jobs, when executing a single job", requiresArg: false})
    .completion("completion", false, async (current, a) => {
        const cwd = a.cwd as string || process.cwd();
        const pipelineIid = predefinedVariables.getPipelineIid(cwd);
        const parser = new Parser(cwd, pipelineIid, true);
        return parser.getJobNames();
    })
    .argv;
