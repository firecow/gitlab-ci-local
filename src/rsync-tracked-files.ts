import fs from "fs-extra";
import {Shell, safeBashString} from "./shell.js";
import {withFileLock} from "./pid-file-lock.js";

const RSYNC_LOCK_TIMEOUT_MS = 3_600_000;

export async function rsyncTrackedFiles (cwd: string, stateDir: string, ignoresFile: string, target: string): Promise<{hrdeltatime: [number, number]}> {
    const time = process.hrtime();
    const lockPath = `${cwd}/${stateDir}/rsync-${target}.lock`;
    await withFileLock(lockPath, async () => {
        await fs.mkdirp(`${cwd}/${stateDir}/builds/${target}`);
        const {stdout: untracked} = await Shell.bash("git ls-files -o --directory", cwd);
        const untrackedFile = `${cwd}/${stateDir}/rsync-exclude-${target}`;
        await fs.writeFile(untrackedFile, untracked.split("\n").filter(line => line !== "").map(line => `/${line}`).join("\n"));
        const cmd = [
            "rsync -a --delete-excluded --delete",
            `--exclude-from=${safeBashString(untrackedFile)}`,
            ...await fs.pathExists(ignoresFile) ? [`--exclude-from=${safeBashString(ignoresFile)}`] : [],
            "--exclude .git/lfs",
            `--exclude ${stateDir}/`,
            "./",
            `${stateDir}/builds/${target}/`,
        ].join(" ");
        await Shell.bash(cmd, cwd);
    }, RSYNC_LOCK_TIMEOUT_MS);
    return {hrdeltatime: process.hrtime(time)};
}
