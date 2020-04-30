import {Commander} from "../commander";
import {Parser} from "../parser";
import * as predefinedVariables from "../predefined_variables";

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
    const pipelineId = await predefinedVariables.getPipelineId(cwd);
    const parser = new Parser(cwd, pipelineId);

    if (argv.list !== undefined) {
        await Commander.runList(parser);
        return;
    }

    if (argv.job) {
        await Commander.runSingleJob(parser, argv.job as string);
    } else {
        await predefinedVariables.incrementPipelineId(cwd);
        await Commander.runPipeline(parser, argv.manual as string[] || []);
    }
};
