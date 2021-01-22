import * as fs from "fs-extra";
import * as yargs from "yargs";
import * as path from "path";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";

const checkFolderAndFile = (cwd: string) => {
    if (!fs.pathExistsSync(`${cwd}`)) {
        process.stdout.write(`${cwd} is not a directory\n`);
        process.exit(1);
    }

    if (!fs.existsSync(`${cwd}/.gitlab-ci.yml`)) {
        process.stdout.write(`${cwd} does not contain .gitlab-ci.yml\n`);
        process.exit(1);
    }
}

exports.command = "$0 [job]";
exports.describe = "Runs the entire pipeline or a single [job]";
exports.builder = (y: any) => {
    y.positional("job", {
        describe: "Jobname to execute",
        type: "string",
    });
};

export async function handler(argv: any) {
    const cwd = argv.cwd ? path.resolve(argv.cwd) : process.cwd();
    if (argv.completion !== undefined) {
        yargs.showCompletionScript();
    } else if (argv.list !== undefined) {
        checkFolderAndFile(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runList(parser);
    } else if (argv.job) {
        checkFolderAndFile(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runSingleJob(parser, argv.job as string, argv.needs as boolean);
    } else {
        checkFolderAndFile(cwd);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runPipeline(parser, argv.manual as string[] || []);
    }
}

exports.handler = handler;
