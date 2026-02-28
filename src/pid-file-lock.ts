import fs from "fs-extra";
import path from "path";
import {randomInt} from "crypto";

const LOCK_TIMEOUT_MS = 30_000;
const LOCK_RETRY_BASE_MS = 50;
const LOCK_RETRY_MAX_MS = 500;

const acquireLock = (lockPath: string): boolean => {
    try {
        fs.writeFileSync(lockPath, `${process.pid}`, {flag: "wx"});
        return true;
    } catch (err: any) {
        if (err.code === "EEXIST") {
            return false;
        }
        throw err;
    }
};

const tryRemoveStaleLock = (lockPath: string): boolean => {
    let content: string;
    try {
        content = fs.readFileSync(lockPath, "utf8").trim();
    } catch {
        return true;
    }

    const pid = parseInt(content, 10);
    if (isNaN(pid)) {
        try {
            fs.unlinkSync(lockPath);
        } catch {
            // Another process already cleaned it up
        }
        return true;
    }

    try {
        process.kill(pid, 0);
        return false;
    } catch (err: any) {
        if (err.code !== "ESRCH") {
            return false;
        }
    }

    try {
        fs.unlinkSync(lockPath);
    } catch {
        // Another process already cleaned it up
    }
    return true;
};

export const withFileLock = async <T>(lockPath: string, fn: () => Promise<T>): Promise<T> => {
    await fs.ensureDir(path.dirname(lockPath));
    const startTime = Date.now();

    while (!acquireLock(lockPath)) {
        if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
            throw new Error(`Timed out waiting for lock: ${lockPath}`);
        }

        if (tryRemoveStaleLock(lockPath)) {
            continue;
        }

        const jitter = randomInt(LOCK_RETRY_BASE_MS, LOCK_RETRY_MAX_MS);
        await new Promise((resolve) => setTimeout(resolve, jitter));
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
