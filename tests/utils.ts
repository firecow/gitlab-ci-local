import fs from "fs-extra";

export function isSshDirFound () {
    try {
        fs.statSync(`${process.env.HOME}/.ssh`);
        return true;
    } catch {
        return false;
    }
}


export function stripAnsi (str: string) {
    // Copied from https://github.com/chalk/ansi-regex/blob/main/index.js#L1-L8
    const pattern = [
        "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
        "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
    ].join("|");
    return str.replace(new RegExp(pattern, "g"), "");
}
