import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {withFileLock} from "../src/pid-file-lock.js";

let lockPath: string;

describe("withFileLock", () => {
    beforeEach(async () => {
        lockPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "gcl-lock-")), "test.lock");
    });

    afterEach(async () => {
        await fs.remove(path.dirname(lockPath));
    });

    test("serializes overlapping holders and releases the lock", async () => {
        const events: string[] = [];
        const hold = (name: string) => withFileLock(lockPath, async () => {
            events.push(`${name}-enter`);
            await new Promise(resolve => setTimeout(resolve, 100));
            events.push(`${name}-exit`);
        });

        await Promise.all([hold("a"), hold("b")]);

        expect(events).toHaveLength(4);
        expect(events[1]).toBe(`${events[0].replace("-enter", "")}-exit`);
        expect(events[3]).toBe(`${events[2].replace("-enter", "")}-exit`);
        expect(await fs.pathExists(lockPath)).toBe(false);
    });

    test("uses the given timeout instead of the default", async () => {
        let held: () => void;
        const holding = new Promise<void>(resolve => (held = resolve));
        const holder = withFileLock(lockPath, async () => {
            held();
            await new Promise(resolve => setTimeout(resolve, 1500));
        });
        await holding;

        await expect(withFileLock(lockPath, async () => "acquired", 100)).rejects.toThrow(`Timed out waiting for lock: ${lockPath}`);
        await holder;
    });

    test("releases the lock when the callback throws", async () => {
        await expect(withFileLock(lockPath, async () => {
            throw new Error("boom");
        })).rejects.toThrow("boom");

        expect(await fs.pathExists(lockPath)).toBe(false);
        expect(await withFileLock(lockPath, async () => "acquired")).toBe("acquired");
    });
});
