#!/usr/bin/env node
import chalk from "chalk-template";
import yargs from "yargs";
import {Parser} from "./parser.js";
import * as state from "./state.js";
import {WriteStreamsProcess, WriteStreamsMock} from "./write-streams.js";
import {handler} from "./handler.js";
import {Executor} from "./executor.js";
import {Argv} from "./argv.js";
import {AssertionError} from "assert";
import {Job, cleanupJobResources} from "./job.js";
import {GitlabRunnerPresetValues} from "./gitlab-preset.js";

const jobs: Job[] = [];

process.on("SIGINT", async (_: string, code: number) => {
    await cleanupJobResources(jobs);
    process.exit(code);
});

// Graceful shutdown for nodemon
process.on("SIGUSR2", async () => await cleanupJobResources(jobs));

(() => {
    const yparser = yargs(process.argv.slice(2));
    yparser.parserConfiguration({"greedy-arrays": false})
        .showHelpOnFail(false)
        .version("4.64.1")
        .wrap(yparser.terminalWidth?.())
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
        .command({
            command: "serve",
            describe: "Start web UI server for monitoring pipelines",
            handler: async (argv: any) => {
                try {
                    const {WebServer} = await import("./web/server/index.js");
                    const {EventEmitter} = await import("./web/events/event-emitter.js");

                    const server = new WebServer({
                        port: argv.port || 3000,
                        cwd: argv.cwd || process.cwd(),
                        stateDir: argv.stateDir || ".gitlab-ci-local",
                        mountCwd: argv.mountCwd || false,
                        volumes: argv.volume || [],
                        helperImage: argv.helperImage,
                    });

                    // Enable events globally for CLI runs to be monitored
                    // Use GCIL_ prefix to avoid yargs .env("GCL") parsing it as a CLI argument
                    process.env.GCIL_WEB_UI_ENABLED = "true";
                    EventEmitter.getInstance().enable();

                    // Graceful shutdown handler
                    const shutdown = async (signal: string) => {
                        console.log(`\nReceived ${signal}, shutting down gracefully...`);
                        try {
                            await server.stop();
                            console.log("Server stopped.");
                            process.exit(0);
                        } catch (err) {
                            console.error("Error during shutdown:", err);
                            process.exit(1);
                        }
                    };

                    process.on("SIGINT", () => shutdown("SIGINT"));
                    process.on("SIGTERM", () => shutdown("SIGTERM"));

                    await server.start();

                    // Keep process alive
                    await new Promise(() => {});
                } catch (e: any) {
                    process.stderr.write(chalk`{red ${e.stack ?? e}}\n`);
                    process.exit(1);
                }
            },
            builder: (y: any) => {
                return y.option("port", {
                    type: "number",
                    description: "Port for web UI server",
                    default: 3000,
                });
            },
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
        .option("validate-dependency-chain", {
            type: "boolean",
            description: "Validate that jobs needed or dependent by active jobs under specified conditions are also active without actually running the jobs. Uses fail-fast approach - stops at first validation error for both 'needs' and 'dependencies' keywords. If validation fails, use --list flag to see which jobs will run under specified conditions",
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
        .option("evaluate-rule-changes", {
            type: "boolean",
            description: "Whether to evaluate rule:changes. If set to false, rules:changes will always evaluate to true",
            requiresArg: false,
            default: Argv.default.evaluateRuleChanges,
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
            type: "array",
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
        .option("force-shell-executor", {
            type: "boolean",
            description: "Forces all jobs to be executed using the shell executor. (Only use this option for trusted job)",
            requiresArg: false,
        })
        .option("shell-executor-no-image", {
            type: "boolean",
            description: "Whether to use shell executor when no image is specified.",
            requiresArg: false,
        })
        .option("default-image", {
            type: "string",
            description: "When using --shell-executor-no-image=false which image to be used for the container. Defaults to docker.io/ruby:3.1 if not set.",
            requiresArg: false,
        })
        .option("wait-image", {
            type: "string",
            description: "Which image to be used for the wait container. Defaults to docker.io/sumina46/wait-for-it:latest if not set.",
            requiresArg: false,
        })
        .option("helper-image", {
            type: "string",
            description: "When using --shell-executor-no-image=false which image to be used for the utils container. Defaults to docker.io/firecow/gitlab-ci-local-util:latest if not set.",
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
        .option("userns", {
            type: "string",
            description: "Set docker executor userns option",
            requiresArg: false,
        })
        .option("privileged", {
            type: "boolean",
            description: "Set docker executor to privileged mode",
            requiresArg: false,
        })
        .option("device", {
            type: "array",
            description: "Add devices to docker executor",
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
        .option("mount-cwd", {
            type: "boolean",
            description: "Bind mount cwd into docker containers (instant startup, no copy)",
            requiresArg: false,
        })
        .option("extra-host", {
            type: "array",
            description: "Add extra docker host entries",
            requiresArg: false,
        })
        .option("ca-file", {
            type: "string",
            description: "Path to custom CA certificate file to mount in containers",
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
        .option("ignore-schema-paths", {
            type: "array",
            requiresArg: false,
            default: Argv.default.ignoreSchemaPaths,
            description: "The json schema paths that will be ignored",
        })
        .option("ignore-predefined-vars", {
            type: "string",
            coerce: (v) => v.split(","),
            requiresArg: false,
            default: Argv.default.ignorePredefinedVars,
            describe: "Comma-seperated list of predefined pipeline variables for which warnings should be suppressed",
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
        .option("color", {
            requiresArg: false,
            default: true,
            description: "Enables color",
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
            } catch {
                return ["Parser-Failed!"];
            }

        })
        .parse();
})();
