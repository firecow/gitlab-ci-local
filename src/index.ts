import * as yargs from "yargs";
import {Commander} from "./commander";

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
    .version("4.0.0")
    .usage("\nUsage: $0           Run entire pipeline\nUsage: $0 [jobname] Run single job")
    .option("manual", {type: "array", description: "One or more manual jobs to run during a pipeline", requiresArg: true})
    .option("list", {type: "string", description: "List jobs and job information", requiresArg: false})
    .option("cwd", {type: "string", description: "Path to a gitlab-ci.yml", requiresArg: true})
    .option("completion", {type: "string", description: "Generate bash completion script", requiresArg: false})
    .completion("completion", false, async (current, a) => {
        const cwd = a.cwd as string || process.cwd();
        const pipelineIid = predefinedVariables.getPipelineIid(cwd);
        const parser = new Parser(cwd, pipelineIid);
        return parser.getJobNames();
    })
    .epilogue('for more information, find our manual at http://github.com/firecow/')
    .argv;

(async() => {
    const cwd = argv.cwd as string || process.cwd();
    const pipelineIid = predefinedVariables.getPipelineIid(cwd);
    const parser = new Parser(cwd, pipelineIid);

    if (argv.completion !== undefined) {
        yargs.showCompletionScript();
        return;
    }

    if (argv.list !== undefined) {
        await Commander.runList(parser);
        return;
    }

    if (argv._.length > 0) {
        await Commander.runSingleJob(parser, argv._[0] as string);
    } else {
        predefinedVariables.incrementPipelineIid(cwd);
        await Commander.runPipeline(parser, argv.manual as string[] || []);
    }
})();

