import {red} from "ansi-colors";
import * as fs from "fs-extra";
import * as path from "path";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import {ExitError} from "./types/exit-error";

const checkFolderAndFile = (cwd: string) => {
    if (!fs.pathExistsSync(`${cwd}`)) {
        throw new ExitError(`${cwd} is not a directory`);
    }

    if (!fs.existsSync(`${cwd}/.gitlab-ci.yml`)) {
        throw new ExitError(`${cwd} does not contain .gitlab-ci.yml`);
    }
};

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
    if (argv.completion != null) {
        yargs.showCompletionScript();
    } else if (argv.list != null) {
        checkFolderAndFile(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        Commander.runList(parser);
    } else if (argv.job) {
        checkFolderAndFile(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runSingleJob(parser, argv.job, argv.needs);
    } else {
        checkFolderAndFile(cwd);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runPipeline(parser, argv.manual || []);
    }
}

exports.handler = async (argv: any) => {
    try {
        await handler(argv);
    } catch (e) {
        if (e instanceof ExitError) {
            process.stderr.write(`${red(e.message)}\n`);
            process.exit(1);
        }
        throw e;
    }
};
