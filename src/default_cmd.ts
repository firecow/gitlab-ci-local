import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as predefinedVariables from "./predefined_variables";

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
    const pipelineIid = predefinedVariables.getPipelineIid(cwd);
    const parser = new Parser(cwd, pipelineIid);

    if (argv.completion !== undefined) {
        yargs.showCompletionScript();
        return;
    }

    if (argv.list !== undefined) {
        await Commander.runList(parser);
        return;
    }

    if (argv.job) {
        await Commander.runSingleJob(parser, argv.job as string);
    } else {
        predefinedVariables.incrementPipelineIid(cwd);
        await Commander.runPipeline(parser, argv.manual as string[] || []);
    }
};
