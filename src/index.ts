#!/usr/bin/env node
import "source-map-support/register";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import yargs from "yargs";
import {Parser} from "./parser";
import * as state from "./state";
import {WriteStreamsProcess, WriteStreamsMock} from "./write-streams";
import {handler} from "./handler";
import {Executor} from "./executor";
import {Argv} from "./argv";
import {AssertionError} from "assert";
import {Job, cleanupJobResources} from "./job";
import {GitlabRunnerPresetValues} from "./gitlab-preset";

const jobs: Job[] = [];

process.on("SIGINT", async (_: string, code: number) => {
    await cleanupJobResources(jobs);
    process.exit(code);
});

// Graceful shutdown for nodemon
process.on("SIGUSR2", async () => await cleanupJobResources(jobs));

(() => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
    yargs(process.argv.slice(2))
        .parserConfiguration({"greedy-arrays": false})
        .showHelpOnFail(false)
        .version(packageJson["version"])
        .wrap(yargs.terminalWidth?.())
        .command({
            handler: async (argv) => {
                try {
                    await handler(argv, new WriteStreamsProcess(), jobs);
                    const failedJobs = Executor.getFailed(jobs);
                    process.exit(failedJobs.length > 0 ? 1 : 0);
                } catch (e: any) {
                    if (e instanceof AssertionError) {
                        process.stderr.write(chalk`{red ${e.message.trim()}}\n`);
                    } else if (e instanceof AggregateError) {
                        e.errors.forEach((aggE) => process.stderr.write(chalk`{red ${aggE.stack ?? aggE}}\n`));
                    } else {
                        process.stderr.write(chalk`{red ${e.stack ?? e}}\n`);
                    }
                    await cleanupJobResources(jobs);
                    process.exit(1);
                }
            },
            builder: (y: any) => {
                return y
                    .positional("job", {
                        describe: "Jobname's to execute",
                        type: "string", // Type here is referring to each element of the positional args
                    })
                    // by default yargs's positional options (args) can be used as options (flags) so this coerce is solely for
                    // handling scenario when a single --job option flag is passed
                    // Once https://github.com/yargs/yargs/issues/2196 is implemented, we can probably remove this
                    .coerce("job", (args: string[]) => {
                        if (!Array.isArray(args)) return [args];
                        return args;
                    });
            },
            command: "$0 [job..]",
            describe: "Runs the entire pipeline or job's",
        })
        .usage("Find more information at https://github.com/firecow/gitlab-ci-local.\nNote: To negate an option use '--no-(option)'.")
        .strictOptions()
        .env("GCL")
        .option("manual", {
            type: "array",
            description: "One or more manual jobs to run during a pipeline",
            requiresArg: true,
        })
        .option("list", {
            type: "boolean",
            description: "List job information, when:never excluded",
            requiresArg: false,
        })
        .option("list-all", {
            type: "boolean",
            description: "List job information, when:never included",
            requiresArg: false,
        })
        .option("list-json", {
            type: "boolean",
            description: "List job information in json format, when:never included",
            requiresArg: false,
        })
        .option("list-csv", {
            type: "boolean",
            description: "List job information in csv format, when:never excluded",
            requiresArg: false,
        })
        .option("list-csv-all", {
            type: "boolean",
            description: "List job information in csv format, when:never included",
            requiresArg: false,
        })
        .option("preview", {
            type: "boolean",
            description: "Print YML with defaults, includes, extends and reference's expanded",
            requiresArg: false,
        })
        .option("cwd", {
            type: "string",
            description: "Path to a current working directory",
            requiresArg: true,
        })
        .option("variables-file", {
            type: "string",
            description: "Path to the project file variables",
            requiresArg: true,
            default: Argv.default.variablesFile,
        })
        .option("completion", {
            type: "boolean",
            description: "Generate tab completion script",
            requiresArg: false,
        })
        .option("needs", {
            type: "boolean",
            description: "Run needed jobs, when executing specific jobs",
            requiresArg: false,
        })
        .option("only-needs", {
            type: "boolean",
            description: "Run needed jobs, except the specified jobs themselves",
            requiresArg: false,
        })
        .option("stage", {
            type: "string",
            description: "Run all jobs in a specific stage",
            requiresArg: false,
        })
        .option("variable", {
            type: "array",
            description: "Add variable to all executed jobs (--variable HELLO=world)",
            requiresArg: false,
        })
        .option("unset-variable", {
            type: "array",
            description: "Unsets a variable (--unset-variable HELLO)",
            requiresArg: false,
        })
        .option("remote-variables", {
            type: "string",
            description: "Fetch variables file from remote location",
            requiresArg: false,
        })
        .option("state-dir", {
            type: "string",
            description: "Location of the .gitlab-ci-local state dir, relative to cwd, eg. (symfony/.gitlab-ci-local/)",
            requiresArg: false,
        })
        .option("file", {
            type: "string",
            description: "Location of the .gitlab-ci.yml, relative to cwd, eg. (gitlab/.gitlab-ci.yml)",
            requiresArg: false,
        })
        .option("home", {
            type: "string",
            description: "Location of the HOME .gitlab-ci-local folder ($HOME/.gitlab-ci-local/variables.yml)",
            requiresArg: false,
        })
        .option("shell-isolation", {
            type: "boolean",
            description: "Enable artifact isolation for shell-executor jobs",
            requiresArg: false,
        })
        .option("shell-executor-no-image", {
            type: "boolean",
            description: "Whether to use shell executor when no image is specified.",
            requiresArg: false,
        })
        .option("mount-cache", {
            type: "boolean",
            description: "Enable docker mount based caching",
            requiresArg: false,
        })
        .option("umask", {
            type: "boolean",
            description: "Sets docker user to 0:0",
            requiresArg: false,
        })
        .option("privileged", {
            type: "boolean",
            description: "Set docker executor to privileged mode",
            requiresArg: false,
        })
        .option("ulimit", {
            type: "number",
            description: "Set docker executor ulimit",
            requiresArg: false,
        })
        .option("network", {
            type: "array",
            description: "Add networks to docker executor",
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
        .option("pull-policy", {
            type: "string",
            description: "Set image pull-policy (always or if-not-present)",
            requiresArg: false,
        })
        .option("fetch-includes", {
            type: "boolean",
            description: "Fetch all external includes one more time",
            requiresArg: false,
        })
        .option("maximum-includes", {
            type: "number",
            description: "The maximum number of includes",
            requiresArg: false,
        })
        .option("artifacts-to-source", {
            type: "boolean",
            description: "Copy the generated artifacts into cwd",
            requiresArg: false,
        })
        .option("cleanup", {
            type: "boolean",
            description: "Remove docker resources after they've been used",
            requiresArg: false,
        })
        .option("quiet", {
            type: "boolean",
            description: "Suppress all job output",
            requiresArg: false,
        })
        .option("timestamps", {
            type: "boolean",
            description: "Show timestamps and job duration in the logs",
            requiresArg: false,
        })
        .option("max-job-name-padding", {
            type: "number",
            description: "Maximum padding for job name (use <= 0 for no padding)",
            requiresArg: false,
        })
        .option("json-schema-validation", {
            type: "boolean",
            description: "Whether to enable json schema validation",
            requiresArg: false,
        })
        .option("concurrency", {
            type: "number",
            description: "Limit the number of jobs that run simultaneously",
            requiresArg: false,
        })
        .option("container-executable", {
            type: "string",
            description: "Command to start the container engine (docker or podman)",
            requiresArg: false,
        })
        .option("container-mac-address", {
            type: "string",
            description: "Container MAC address (e.g., aa:bb:cc:dd:ee:ff)",
            requiresArg: false,
        })
        .option("container-emulate", {
            type: "string",
            description: "The name, without the architecture, of a gitlab hosted runner to emulate. See here: https://docs.gitlab.com/ee/ci/runners/hosted_runners/linux.html#machine-types-available-for-linux---x86-64",
            choices: GitlabRunnerPresetValues,
        })
        .completion("completion", false, (current: string, yargsArgv: any, completionFilter: any, done: (completions: string[]) => any) => {
            try {
                if (current.startsWith("-")) {
                    completionFilter();
                } else {
                    Argv.build({...yargsArgv, autoCompleting: true})
                        .then(argv => state.getPipelineIid(argv.cwd, argv.stateDir).then(pipelineIid => ({argv, pipelineIid})))
                        .then(({argv, pipelineIid}) => Parser.create(argv, new WriteStreamsMock(), pipelineIid, []))
                        .then((parser) => {
                            const jobNames = [...parser.jobs.values()].filter((j) => j.when != "never").map((j) => j.name);
                            done(jobNames);
                        });
                }
            } catch (e) {
                return ["Parser-Failed!"];
            }

        })
        .parse();
})();
