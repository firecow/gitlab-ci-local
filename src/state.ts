import fs from "fs-extra";
import * as yaml from "js-yaml";
import {withFileLock} from "./pid-file-lock.js";

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

const incrementPipelineIid = async (cwd: string, stateDir: string): Promise<number> => {
    const stateFile = `${cwd}/${stateDir}/state.yml`;
    const lockPath = `${cwd}/${stateDir}/state.lock`;

    return withFileLock(lockPath, async () => {
        const ymlData = await loadStateYML(stateFile);
        const newIid = ymlData["pipelineIid"] == null ? 0 : ymlData["pipelineIid"] + 1;
        ymlData["pipelineIid"] = newIid;

        const tmpFile = `${stateFile}.tmp.${process.pid}`;
        await fs.outputFile(tmpFile, `---\n${yaml.dump(ymlData)}`);
        await fs.rename(tmpFile, stateFile);

        return newIid;
    });
};

export {getPipelineIid, incrementPipelineIid};
