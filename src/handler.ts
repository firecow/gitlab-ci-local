import * as yaml from "js-yaml";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import prettyHrtime from "pretty-hrtime";
import {WriteStreams} from "./write-streams";
import {cleanupJobResources, Job} from "./job";
import {Utils} from "./utils";
import {Argv} from "./argv";
import assert from "assert";

export async function handler (args: any, writeStreams: WriteStreams, jobs: Job[] = []) {
    const argv = await Argv.build(args, writeStreams);
    const cwd = argv.cwd;
    const stateDir = argv.stateDir;
    let parser: Parser | null = null;

    if (argv.completion) {
        yargs.showCompletionScript();
        return [];
    }

    if (argv.fetchIncludes) {
        await Parser.create(argv, writeStreams, 0, jobs);
        return [];
    }

    if (argv.preview) {
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs, false);
        const gitlabData = parser.gitlabData;
        for (const jobName of Object.keys(gitlabData)) {
            if (jobName === "stages") {
                continue;
            }
            if (jobName.startsWith(".") || ["include", "after_script", "before_script", "default"].includes(jobName)) {
                // Remove since these are redundant info which are already "extended" in the jobs
                delete gitlabData[jobName];
            }
        }
        writeStreams.stdout(`---\n${yaml.dump(gitlabData, {lineWidth: 160})}`);
    } else if (argv.list || argv.listAll) {
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runList(parser, writeStreams, argv.listAll);
    } else if (argv.listJson) {
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runJson(parser, writeStreams);
    } else if (argv.listCsv || argv.listCsvAll) {
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runCsv(parser, writeStreams, argv.listCsvAll);
    } else if (argv.job.length > 0) {
        assert(argv.stage === null, "You cannot use --stage when starting individual jobs");
        const time = process.hrtime();
        if (argv.needs || argv.onlyNeeds) {
            await fs.remove(`${stateDir}/artifacts`);
            await state.incrementPipelineIid(stateDir);
        }
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        await Commander.runJobs(argv, parser, writeStreams);
        if (argv.needs || argv.onlyNeeds) {
            writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
        }
    } else if (argv.stage) {
        const time = process.hrtime();
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        await Commander.runJobsInStage(argv, parser, writeStreams);
        writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    } else {
        const time = process.hrtime();
        await fs.remove(`${stateDir}/artifacts`);
        await state.incrementPipelineIid(stateDir);
        const pipelineIid = await state.getPipelineIid(stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        await Commander.runPipeline(argv, parser, writeStreams);
        writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
    writeStreams.flush();

    return cleanupJobResources(jobs);
}
