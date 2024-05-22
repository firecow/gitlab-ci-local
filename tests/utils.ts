import * as fs from "fs-extra";

export function isSshDirFound () {
    try {
        fs.statSync(`${process.env.HOME}/.ssh`);
        return true;
    } catch {
        return false;
    }
}
