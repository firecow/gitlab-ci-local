import * as fs from "fs-extra";
import * as yaml from "yaml";

import { Parser } from "./parser";

const getPipelineIid = (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = Parser.loadYaml(stateFile);

    return ymlData["pipelineIid"] || 0;
};

const incrementPipelineIid = (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = Parser.loadYaml(stateFile);
    fs.ensureFileSync(stateFile);

    ymlData["pipelineIid"] = ymlData["pipelineIid"] !== undefined ? ymlData["pipelineIid"] + 1 : 0;
    fs.writeFileSync(stateFile, yaml.stringify(ymlData));
};

const getJobId = (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = Parser.loadYaml(stateFile);

    return ymlData["jobId"] || 0;
};

const incrementJobId = (cwd: string) => {
    const stateFile = `${cwd}/.gitlab-ci-local/state.yml`;
    const ymlData = Parser.loadYaml(stateFile);
    fs.ensureFileSync(stateFile);

    ymlData["jobId"] = ymlData["jobId"] !== undefined ? ymlData["jobId"] + 1 : 100000;
    fs.writeFileSync(stateFile, yaml.stringify(ymlData));
};

export { getPipelineIid, incrementPipelineIid, getJobId, incrementJobId };
