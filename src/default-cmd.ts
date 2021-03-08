import {red} from "ansi-colors";
import * as fs from "fs-extra";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import {ExitError} from "./types/exit-error";
import {assert} from "./asserts";

const checkFolderAndFile = (cwd: string) => {
    assert(fs.pathExistsSync(cwd), `${cwd} is not a directory`);
    assert(fs.existsSync(`${cwd}/.gitlab-ci.yml`), `${cwd} does not contain .gitlab-ci.yml`);
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
    assert(typeof argv.cwd != "object", '--cwd option cannot be an array');
    const cwd = argv.cwd?.replace(/\/$/, "") ?? ".";
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
        await Commander.runSingleJob(parser, argv.job, argv.needs, argv.privileged);
    } else {
        checkFolderAndFile(cwd);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runPipeline(parser, argv.manual || [], argv.privileged);
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
