import fs from "fs-extra";
import * as yaml from "js-yaml";

const loadStateYML = async (stateFile: string): Promise<any> => {
    if (!fs.existsSync(stateFile)) {
        return {};
    }
    const stateFileContent = await fs.readFile(stateFile, "utf8");
    return yaml.load(stateFileContent) || {};
};

const getPipelineIid = async (cwd: string, stateDir: string) => {
    const stateFile = `${cwd}/${stateDir}/state.yml`;
    const ymlData = await loadStateYML(stateFile);

    return ymlData["pipelineIid"] ? ymlData["pipelineIid"] : 0;
};

const incrementPipelineIid = async (cwd: string, stateDir: string) => {
    const stateFile = `${cwd}/${stateDir}/state.yml`;
    const ymlData = await loadStateYML(stateFile);

    ymlData["pipelineIid"] = ymlData["pipelineIid"] != null ? ymlData["pipelineIid"] + 1 : 0;
    await fs.outputFile(stateFile, `---\n${yaml.dump(ymlData)}`);
};

export {getPipelineIid, incrementPipelineIid};
