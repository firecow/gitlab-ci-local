import {vi} from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {Utils} from "../src/utils.js";

const stateDir = ".gitlab-ci-local";

let cwd: string;
let ignoresFile: string;

const recordRsyncIntervals = () => {
    const intervals: {target: string; start: number; end: number}[] = [];
    const original = Utils.bash.bind(Utils);
    let clock = 0;
    vi.spyOn(Utils, "bash").mockImplementation(async (shellScript: string, bashCwd?: string) => {
        const target = /builds\/(\S+)\/$/.exec(shellScript)?.[1];
        if (!shellScript.startsWith("rsync ") || !target) {
            return original(shellScript, bashCwd);
        }
        const start = clock++;
        const result = await original(shellScript, bashCwd);
        intervals.push({target, start, end: clock++});
        return result;
    });
    return intervals;
};

const overlaps = (a: {start: number; end: number}, b: {start: number; end: number}) => a.start < b.end && b.start < a.end;

describe("rsyncTrackedFiles", () => {
    beforeEach(async () => {
        cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gcl-rsync-"));
        ignoresFile = `${cwd}/.gitlab-ci-local-ignore`;
        const refsDir = `${cwd}/.git/logs/refs/remotes/origin`;
        for (let i = 0; i < 100; i++) {
            await fs.outputFile(`${refsDir}/renovate${i}/registry.example.com-image-1.x`, "a".repeat(4096));
        }
        for (let i = 0; i < 50; i++) {
            await fs.outputFile(`${cwd}/src/file${i}.txt`, `content ${i}`);
        }
        await Utils.bash("git init -q && git add -A", cwd);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.remove(cwd);
    });

    test("concurrent calls for the same target never overlap", async () => {
        const intervals = recordRsyncIntervals();

        await Promise.all(Array.from({length: 4}, () => Utils.rsyncTrackedFiles(cwd, stateDir, ignoresFile, ".docker")));

        expect(intervals).toHaveLength(4);
        expect(intervals.filter(a => intervals.some(b => a !== b && overlaps(a, b)))).toEqual([]);

        expect(await fs.pathExists(`${cwd}/${stateDir}/builds/.docker/.git/logs/refs/remotes/origin/renovate99/registry.example.com-image-1.x`)).toBe(true);
        expect(await fs.pathExists(`${cwd}/${stateDir}/builds/.docker/src/file49.txt`)).toBe(true);
        expect(await fs.pathExists(`${cwd}/${stateDir}/rsync-.docker.lock`)).toBe(false);
    });

    test("concurrent calls for distinct targets do overlap", async () => {
        const intervals = recordRsyncIntervals();

        await Promise.all([
            Utils.rsyncTrackedFiles(cwd, stateDir, ignoresFile, "job-a"),
            Utils.rsyncTrackedFiles(cwd, stateDir, ignoresFile, "job-b"),
        ]);

        expect(intervals.map(i => i.target).sort()).toEqual(["job-a", "job-b"]);
        expect(overlaps(intervals[0], intervals[1])).toBe(true);

        expect(await fs.pathExists(`${cwd}/${stateDir}/builds/job-a/src/file49.txt`)).toBe(true);
        expect(await fs.pathExists(`${cwd}/${stateDir}/builds/job-b/src/file49.txt`)).toBe(true);
    });
});
