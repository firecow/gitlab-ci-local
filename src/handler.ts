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

const generateGitIgnore = (cwd: string, stateDir: string) => {
    const gitIgnoreFilePath = `${cwd}/${stateDir}/.gitignore`;
    const gitIgnoreContent = "*\n!.gitignore\n";
    if (!fs.existsSync(gitIgnoreFilePath)) {
        fs.outputFileSync(gitIgnoreFilePath, gitIgnoreContent);
    }
};

export async function handler (args: any, writeStreams: WriteStreams, jobs: Job[] = []) {
    const argv = new Argv(args);
    const cwd = argv.cwd;
    const stateDir = argv.stateDir;
    const file = argv.file;
    let parser: Parser | null = null;

    if (argv.completion) {
        yargs.showCompletionScript();
        return [];
    }

    assert(fs.existsSync(`${cwd}/${file}`), `${cwd}/${file} could not be found`);

    if (argv.fetchIncludes) {
        await Parser.create(argv, writeStreams, 0, jobs);
        return [];
    }

    if (argv.preview || argv.merge) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs, !argv.merge);
        const gitlabData = parser.gitlabData;
        for (const jobName of Object.keys(gitlabData)) {
            if (jobName === "stages") {
                continue;
            }
            if (Job.illegalJobNames.has(jobName) || jobName.startsWith(".")) {
                delete gitlabData[jobName];
            }
        }
        writeStreams.stdout(`---\n${yaml.dump(gitlabData, {lineWidth: 160})}`);
    } else if (argv.list || argv.listAll) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runList(parser, writeStreams, argv.listAll);
    } else if (argv.listJson) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runJson(parser, writeStreams);
    } else if (argv.listCsv || argv.listCsvAll) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runCsv(parser, writeStreams, argv.listCsvAll);
    } else if (argv.job.length > 0) {
        assert(argv.stage === null, "You cannot use --stage when starting individual jobs");
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        if (argv.needs || argv.onlyNeeds) {
            await fs.remove(`${cwd}/${stateDir}/artifacts`);
            await state.incrementPipelineIid(cwd, stateDir);
        }
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        await Commander.runJobs(argv, parser, writeStreams);
        if (argv.needs || argv.onlyNeeds) {
            writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
        }
    } else if (argv.stage) {
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        await Commander.runJobsInStage(argv, parser, writeStreams);
        writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    } else {
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        await fs.remove(`${cwd}/${stateDir}/artifacts`);
        await state.incrementPipelineIid(cwd, stateDir);
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        await Commander.runPipeline(argv, parser, writeStreams);
        writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
    writeStreams.flush();

    return cleanupJobResources(jobs);
}

