import {Commander} from "../commander";
import {Parser} from "../parser";
import * as predefinedVariables from "../predefined_variables";

exports.command = "list";
exports.describe = "Lists jobs";
exports.handler = async(argv: any) => {
    const cwd = argv.cwd as string || process.cwd();
    const pipelineId = await predefinedVariables.getPipelineId(cwd);
    const parser = new Parser(cwd, pipelineId);
    await Commander.runList(parser);
};
