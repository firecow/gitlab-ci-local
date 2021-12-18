#!/usr/bin/env node
import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import * as sourceMapSupport from "source-map-support";
import yargs from "yargs";
import {Parser} from "./parser";
import * as state from "./state";
import {ExitError} from "./types/exit-error";
import {ProcessWriteStreams} from "./process-write-streams";
import {handler} from "./handler";
import {JobExecutor} from "./job-executor";
import {setCompletionModeEnabled} from "./completion-mode";

sourceMapSupport.install();

(() => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
    yargs(process.argv.slice(2))
        .version(packageJson["version"])
        .showHelpOnFail(false)
        .wrap(yargs.terminalWidth())
        .command({
            handler: async (argv) => {
                try {
                    const jobs = await handler(argv, new ProcessWriteStreams());
                    const failedJobs = JobExecutor.getFailed(jobs);
                    process.exit(failedJobs.length > 0 ? 1 : 0);
                } catch (e) {
                    if (e instanceof ExitError) {
                        process.stderr.write(chalk`{red ${e.message}}\n`);
                        process.exit(1);
                    }
                    throw e;
                }
            },
            builder: (y: any) => {
                return y.positional("job", {
                    describe: "Jobname's to execute",
                    type: "array",
                });
            },
            command: "$0 [job..]",
            describe: "Runs the entire pipeline or job's",
        })
        .usage("Find more information at https://github.com/firecow/gitlab-ci-local")
        .strictOptions()
        .env("GCL")
        .option("manual", {
            type: "array",
            description: "One or more manual jobs to run during a pipeline",
            requiresArg: true,
        })
        .option("list", {
            type: "string",
            description: "List jobs and job information, when:never excluded",
            requiresArg: false,
        })
        .option("list-all", {
            type: "string",
            description: "List jobs and job information, when:never included",
            requiresArg: false,
        })
        .option("preview", {
            type: "string",
            description: "Print YML with defaults, includes, extends and reference's expanded",
            requiresArg: false,
        })
        .option("cwd", {
            type: "string",
            description: "Path to a current working directory",
            requiresArg: true,
        })
        .option("completion", {
            type: "string",
            description: "Generate tab completion script",
            requiresArg: false,
        })
        .option("needs", {
            type: "boolean",
            description: "Run needed jobs, when executing a single job",
            requiresArg: false,
        })
        .option("variable", {
            type: "array",
            description: "Add variable to all executed jobs (--variable HELLO=world)",
            requiresArg: false,
        })
        .option("file", {
            type: "string",
            description: "Specify custom location of the .gitlab-ci.yml. Relative to cwd, eg. (gitlab/.gitlab-ci.yml)",
            requiresArg: false,
        })
        .option("home", {
            type: "string",
            description: "Specify custom HOME location ($HOME/.gitlab-ci-local/variables.yml)",
            requiresArg: false,
        })
        .option("shell-isolation", {
            type: "boolean",
            description: "Enable artifact isolation for shell-executor jobs",
            requiresArg: false,
        })
        .option("mount-cache", {
            type: "boolean",
            description: "Enable docker mount based caching",
            requiresArg: false,
        })
        .option("privileged", {
            type: "boolean",
            description: "Set docker executor to privileged mode",
            requiresArg: false,
        })
        .option("volume", {
            type: "array",
            description: "Add volumes to docker executor",
            requiresArg: false,
        })
        .option("extra-host", {
            type: "array",
            description: "Add extra docker host entries",
            requiresArg: false,
        })
        .completion("completion", false, async (_, yargsArgv) => {
            try {
                setCompletionModeEnabled(true);
                const cwd = yargsArgv.cwd || process.cwd();
                const pipelineIid = await state.getPipelineIid(cwd);
                const parser = await Parser.create({
                    cwd,
                    writeStreams: new ProcessWriteStreams(),
                    pipelineIid,
                    file: yargsArgv.file,
                    variables: {},
                });
                return [...parser.jobs.values()].filter((j) => j.when != "never").map((j) => j.name);
            } catch (e) {
                return ["Parser-Failed!"];
            }

        })
        .parse();
})();

