import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";

exports.command = "$0 [job]";
exports.describe = "Runs the entire pipeline or a single [job]";
exports.builder = (y: any) => {
    y.positional("job", {
        describe: "Jobname to execute",
        type: "string",
    });
};
exports.handler = async(argv: any) => {
    const cwd = argv.cwd as string || process.cwd();

    if (argv.completion !== undefined) {
        yargs.showCompletionScript();
    } else if (argv.list !== undefined) {
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runList(parser);
    } else if (argv.job) {
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runSingleJob(parser, argv.job as string, argv.needs as boolean);
    } else {
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid);
        await Commander.runPipeline(parser, argv.manual as string[] || []);
    }
};
