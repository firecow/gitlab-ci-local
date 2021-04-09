import * as chalk from "chalk";
import * as fs from "fs-extra";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import {ExitError} from "./types/exit-error";
import {assert} from "./asserts";
import * as dotenv from "dotenv";
import * as camelCase from "camelcase";
import * as prettyHrtime from "pretty-hrtime";

let parser: Parser | null = null;
const checkFolderAndFile = (cwd: string, file?: string) => {
    assert(fs.pathExistsSync(cwd), `${cwd} is not a directory`);

    const gitlabFilePath = file ? `${cwd}/${file}` : `${cwd}/.gitlab-ci.yml`;
    assert(fs.existsSync(gitlabFilePath), `${cwd} does not contain ${file ?? ".gitlab-ci.yml"}`);
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

    if (fs.existsSync(`${cwd}/.gitlab-ci-local-env`)) {
        const config = dotenv.parse(fs.readFileSync(`${cwd}/.gitlab-ci-local-env`))
        for (const [key, value] of Object.entries(config)) {
            const argKey = camelCase(key);
            if (argv[argKey] == null) {
                argv[argKey] = value;
            }
        }
    }

    if (argv.completion != null) {
        yargs.showCompletionScript();
    } else if (argv.list != null) {
        checkFolderAndFile(cwd, argv.file);
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(cwd, pipelineIid, false, argv.file, argv.home);
        Commander.runList(parser);
    } else if (argv.job) {
        checkFolderAndFile(cwd, argv.file);
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(cwd, pipelineIid, false, argv.file, argv.home);
        await Commander.runSingleJob(parser, argv.job, argv.needs, argv.privileged);
    } else {
        const time = process.hrtime();
        checkFolderAndFile(cwd, argv.file);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create(cwd, pipelineIid, false, argv.file, argv.home);
        await Commander.runPipeline(parser, argv.manual || [], argv.privileged);
        process.stdout.write(chalk`{grey \npipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
}

exports.handler = async (argv: any) => {
    try {
        await handler(argv);
    } catch (e) {
        if (e instanceof ExitError) {
            process.stderr.write(chalk`{red ${e.message}}\n`);
            process.exit(1);
        }
        throw e;
    }
};

process.on('SIGINT', async (_: string, code: number) => {
    if (!parser) {
        return process.exit(code);
    }
    const promises = [];
    for (const job of parser.getJobs()) {
        promises.push(job.removeContainer());
    }
    await Promise.all(promises);
    process.exit(code);
});
