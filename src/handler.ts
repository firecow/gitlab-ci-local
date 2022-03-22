import * as yaml from "js-yaml";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import prettyHrtime from "pretty-hrtime";
import {WriteStreams} from "./types/write-streams";
import {Job} from "./job";
import {Utils} from "./utils";
import {ExitError} from "./types/exit-error";
import {Argv} from "./argv";
import {assert} from "./asserts";

const generateGitIgnore = (cwd: string) => {
    const gitIgnoreFilePath = `${cwd}/.gitlab-ci-local/.gitignore`;
    const gitIgnoreContent = "*\n!.gitignore\n";
    if (!fs.existsSync(gitIgnoreFilePath)) {
        fs.outputFileSync(gitIgnoreFilePath, gitIgnoreContent);
    }
};

const cleanupResources = async(parser: Parser|null) => {
    if (!parser) {
        return;
    }
    const promises = [];
    for (const job of parser.jobs.values()) {
        promises.push(job.cleanupResources());
    }
    await Promise.all(promises);
};

export async function handler(args: any, writeStreams: WriteStreams): Promise<ReadonlyMap<string, Job>> {
    const argv = new Argv(args);
    const cwd = argv.cwd;
    const file = argv.file;
    let parser: Parser | null = null;

    process.on("exit", () => {
        if (parser) cleanupResources(parser).then().catch();
    });

    process.on("unhandledRejection", async (e) => {
        if (e instanceof ExitError) {
            process.stderr.write(chalk`{red ${e.message.trim()}}\n`);
        } else if (e instanceof Error) {
            process.stderr.write(chalk`{red ${e.stack?.trim() ?? e.message.trim()}}\n`);
        } else if (e) {
            process.stderr.write(chalk`{red ${e.toString().trim()}}\n`);
        }
        if (parser) await cleanupResources(parser);
        process.exit(1);
    });

    process.on("SIGINT", async (_: string, code: number) => {
        await cleanupResources(parser);
        process.exit(code);
    });

    if (argv.completion) {
        yargs.showCompletionScript();
        return new Map<string, Job>();
    }

    assert(fs.existsSync(`${cwd}/${file}`), `${cwd}/${file} could not be found`);

    if (argv.fetchIncludes) {
        parser = await Parser.create(argv, writeStreams, 0);
        return new Map<string, Job>();
    }

    if (argv.preview) {
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(argv, writeStreams, pipelineIid);
        const gitlabData = parser.gitlabData;
        for (const jobName of Object.keys(gitlabData)) {
            if (jobName === "stages") {
                continue;
            }
            if (Job.illegalJobNames.includes(jobName) || jobName.startsWith(".")) {
                delete gitlabData[jobName];
            }
        }
        writeStreams.stdout(`---\n${yaml.dump(gitlabData, {lineWidth: 160})}`);
    } else if (argv.list || argv.listAll) {
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(argv, writeStreams, pipelineIid);
        Commander.runList(parser, writeStreams, argv.listAll);
    } else if (argv.job.length > 0) {
        generateGitIgnore(cwd);
        const time = process.hrtime();
        if (argv.needs) {
            await fs.remove(`${cwd}/.gitlab-ci-local/artifacts`);
            await state.incrementPipelineIid(cwd);
        }
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(argv, writeStreams, pipelineIid);
        await Utils.rsyncTrackedFiles(cwd, ".docker");
        await Commander.runJobs(argv, parser, writeStreams);
        if (argv.needs) {
            writeStreams.stdout(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
        }
    } else {
        generateGitIgnore(cwd);
        const time = process.hrtime();
        await fs.remove(`${cwd}/.gitlab-ci-local/artifacts`);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(argv, writeStreams, pipelineIid);
        await Utils.rsyncTrackedFiles(cwd, ".docker");
        await Commander.runPipeline(argv, parser, writeStreams);
        writeStreams.stdout(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
    writeStreams.flush();

    await cleanupResources(parser);
    return parser.jobs;
}

