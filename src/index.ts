#!/usr/bin/env node
import * as fs from "fs-extra";
import * as path from "path";
import * as sourceMapSupport from "source-map-support";
import * as yargs from "yargs";
import * as defaultCmd from "./default-cmd";
import {Parser} from "./parser";
import * as state from "./state";

sourceMapSupport.install();

(() => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), "utf8"));
    yargs(process.argv.slice(2))
        .version(packageJson['version'])
        .showHelpOnFail(false)
        .wrap(yargs.terminalWidth())
        .command(defaultCmd)
        .usage("Find more information at https://github.com/firecow/gitlab-ci-local")
        .strictOptions()
        .option("manual", {type: "array", description: "One or more manual jobs to run during a pipeline", requiresArg: true})
        .option("list", {type: "string", description: "List jobs and job information", requiresArg: false})
        .option("cwd", {type: "string", description: "Path to a gitlab-ci.yml", requiresArg: true})
        .option("completion", {type: "string", description: "Generate bash completion script", requiresArg: false})
        .option("needs", {type: "boolean", description: "Run needed jobs, when executing a single job", requiresArg: false})
        .completion("completion", false, async (_, yargsArgv) => {
            const cwd = yargsArgv.cwd || process.cwd();
            const pipelineIid = await state.getPipelineIid(cwd);
            const parser = await Parser.create(cwd, pipelineIid, true);
            return parser.getJobNames();
        })
        .parse();
})();

