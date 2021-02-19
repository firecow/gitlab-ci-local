#!/usr/bin/env node
import {red} from "ansi-colors";
import * as fs from "fs-extra";
import * as path from "path";
import * as sourceMapSupport from "source-map-support";
import * as yargs from "yargs";
import * as defaultCmd from "./default-cmd";
import {Parser} from "./parser";
import * as state from "./state";
import {ExitError} from "./types/exit-error";

sourceMapSupport.install();
process.on('unhandledRejection', e => {
    if (e instanceof ExitError) {
        process.stderr.write(`${red(e.message)}\n`);
        process.exit(1);
    }
    process.stderr.write(`${red(`${e}`)}\n`);
    process.exit(1);
});

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
        .option("completion", {type: "string", description: "Generate tab completion script", requiresArg: false})
        .option("needs", {type: "boolean", description: "Run needed jobs, when executing a single job", requiresArg: false})
        .completion("completion", false, async (_, yargsArgv) => {
            try {
                const cwd = yargsArgv.cwd || process.cwd();
                const pipelineIid = await state.getPipelineIid(cwd);
                const parser = await Parser.create(cwd, pipelineIid, true);
                return parser.getJobNames();
            } catch (e) {
                return ["Parser-Failed!"];
            }

        })
        .parse();
})();

