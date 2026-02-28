import fs from "fs-extra";
import * as yaml from "js-yaml";
import path from "path";
import {randomInt} from "crypto";

const LOCK_TIMEOUT_MS = 30_000;
const LOCK_RETRY_BASE_MS = 50;
const LOCK_RETRY_MAX_MS = 500;

const isPidAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

const withFileLock = async <T>(lockPath: string, fn: () => Promise<T>): Promise<T> => {
    const startTime = Date.now();

    while (true) {
        let fd: number | undefined;
        try {
            await fs.ensureDir(path.dirname(lockPath));
            fd = fs.openSync(lockPath, "wx");
            fs.writeFileSync(fd, `${process.pid}`);
            fs.closeSync(fd);
            fd = undefined;
            break;
        } catch (err: any) {
            if (fd !== undefined) {
                fs.closeSync(fd);
            }

            if (err.code !== "EEXIST") {
                throw err;
            }

            if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
                throw new Error(`Timed out waiting for lock: ${lockPath}`, {cause: err});
            }

            let stalePid: number | undefined;
            try {
                const content = fs.readFileSync(lockPath, "utf8").trim();
                stalePid = parseInt(content, 10);
            } catch {
                // Lock file disappeared between open attempt and read — retry immediately
                continue;
            }

            if (!isNaN(stalePid!) && !isPidAlive(stalePid!)) {
                try {
                    fs.unlinkSync(lockPath);
                } catch {
                    // Another process already cleaned it up
                }
                continue;
            }

            const jitter = randomInt(LOCK_RETRY_BASE_MS, LOCK_RETRY_MAX_MS);
            await new Promise((resolve) => setTimeout(resolve, jitter));
        }
    }

    try {
        return await fn();
    } finally {
        try {
            fs.unlinkSync(lockPath);
        } catch {
            // Lock already removed
        }
    }
};

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
        const newIid = ymlData["pipelineIid"] != null ? ymlData["pipelineIid"] + 1 : 0;
        ymlData["pipelineIid"] = newIid;

        const tmpFile = `${stateFile}.tmp.${process.pid}`;
        await fs.outputFile(tmpFile, `---\n${yaml.dump(ymlData)}`);
        await fs.rename(tmpFile, stateFile);

        return newIid;
    });
};

export {getPipelineIid, incrementPipelineIid};
