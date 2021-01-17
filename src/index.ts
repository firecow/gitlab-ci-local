#!/usr/bin/env node
import * as yargs from "yargs";
import {CommandModule} from "yargs";
import {Parser} from "./parser";
import * as defaultCmd from "./default_cmd";
import * as state from "./state";
import {Utils} from "./utils";

process.on('uncaughtException', (err) => {
    Utils.printToStream(`${err.stack ? err.stack : err}`, 'stderr');
    process.exit(5);
});
process.on('unhandledRejection', (reason) => {
    Utils.printToStream(`${reason}`, 'stderr')
    process.exit(5);
});

yargs
    .version("4.8.2")
    .showHelpOnFail(false)
    .wrap(yargs.terminalWidth())
    .command(defaultCmd as CommandModule)
    .usage("Find more information at https://github.com/firecow/gitlab-ci-local")
    .strictOptions()
    .option("manual", {type: "array", description: "One or more manual jobs to run during a pipeline", requiresArg: true})
    .option("list", {type: "string", description: "List jobs and job information", requiresArg: false})
    .option("cwd", {type: "string", description: "Path to a gitlab-ci.yml", requiresArg: true})
    .option("completion", {type: "string", description: "Generate bash completion script", requiresArg: false})
    .option("needs", {type: "boolean", description: "Run needed jobs, when executing a single job", requiresArg: false})
    .completion("completion", false, async (_, yargsArgv) => {
        const cwd = yargsArgv.cwd as string || process.cwd();
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid, true);
        return parser.getJobNames();
    })
    .argv;
