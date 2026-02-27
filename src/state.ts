import fs from "fs-extra";
import * as yaml from "js-yaml";
import path from "path";

const loadStateYML = async (stateFile: string): Promise<any> => {
    if (!fs.existsSync(stateFile)) {
        return {};
    }
    const stateFileContent = await fs.readFile(stateFile, "utf8");
    return yaml.load(stateFileContent) || {};
};

const withFileLock = async <T>(lockPath: string, fn: () => Promise<T>): Promise<T> => {
    const maxWaitMs = 30_000;
    const start = Date.now();

    fs.ensureDirSync(path.dirname(lockPath));

    while (true) {
        try {
            fs.mkdirSync(lockPath);
            break;
        } catch (error: any) {
            if (error.code !== "EEXIST") {
                throw error;
            }

            // Check for stale lock
            try {
                const stat = fs.statSync(lockPath);
                if (Date.now() - stat.mtimeMs > maxWaitMs) {
                    fs.rmdirSync(lockPath);
                    continue;
                }
            } catch {
                continue;
            }

            if (Date.now() - start > maxWaitMs) {
                throw new Error(`Timed out waiting for lock: ${lockPath}`);
            }

            const jitter = Math.random() * 50 + 10;
            await new Promise((resolve) => setTimeout(resolve, jitter));
        }
    }

    try {
        return await fn();
    } finally {
        try {
            fs.rmdirSync(lockPath);
        } catch {
            // Lock dir already removed (e.g. stale-lock cleanup by another process)
        }
    }
};

const getPipelineIid = async (cwd: string, stateDir: string) => {
    const stateFile = `${cwd}/${stateDir}/state.yml`;
    const ymlData = await loadStateYML(stateFile);

    return ymlData["pipelineIid"] ? ymlData["pipelineIid"] : 0;
};

const incrementPipelineIid = async (cwd: string, stateDir: string): Promise<number> => {
    const stateFile = `${cwd}/${stateDir}/state.yml`;
    const lockPath = `${cwd}/${stateDir}/state.yml.lock`;

    return withFileLock(lockPath, async () => {
        const ymlData = await loadStateYML(stateFile);
        ymlData["pipelineIid"] = ymlData["pipelineIid"] != null ? ymlData["pipelineIid"] + 1 : 0;
        const newIid = ymlData["pipelineIid"];

        const tmpFile = path.join(path.dirname(stateFile), `.state.yml.tmp.${process.pid}`);
        fs.outputFileSync(tmpFile, `---\n${yaml.dump(ymlData)}`);
        fs.renameSync(tmpFile, stateFile);

        return newIid;
    });
};

export {getPipelineIid, incrementPipelineIid};
