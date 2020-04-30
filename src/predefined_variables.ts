import * as fs from "fs-extra";
import * as yaml from "js-yaml";

import { Parser } from "./parser";

const getPipelineId = async (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = Parser.loadYaml(stateFile);

    return ymlData["pipelineId"] || 0;
};

const incrementPipelineId = async (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = Parser.loadYaml(stateFile);
    await fs.ensureFile(stateFile);

    ymlData["pipelineId"] = ymlData["pipelineId"] !== undefined ? ymlData["pipelineId"] + 1 : 0;
    await fs.writeFile(stateFile, yaml.safeDump(ymlData));
};

export { getPipelineId, incrementPipelineId };
