import * as fs from "fs-extra";
import * as yaml from "js-yaml";

import {Parser} from "./parser";

const getPipelineIid = async (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = await Parser.loadYaml(stateFile);

    return ymlData["pipelineIid"] ? Number(ymlData["pipelineIid"]) : 0;
};

const incrementPipelineIid = async (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = await Parser.loadYaml(stateFile);

    ymlData["pipelineIid"] = ymlData["pipelineIid"] != null ? Number(ymlData["pipelineIid"]) + 1 : 0;
    await fs.outputFile(stateFile, `---\n${yaml.dump(ymlData)}`);
};

const incrementJobId = async (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = await Parser.loadYaml(stateFile);

    ymlData["jobId"] = ymlData["jobId"] != null ? Number(ymlData["jobId"]) + 1 : 100000;
    await fs.outputFile(stateFile, `---\n${yaml.dump(ymlData)}`);
    return Number(ymlData["jobId"]);
};

export {getPipelineIid, incrementPipelineIid, incrementJobId};
