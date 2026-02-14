import {spyOn} from "bun:test";
import {Utils} from "../../src/utils.js";

const originalBash = Utils.bash.bind(Utils);
const originalSpawn = Utils.spawn.bind(Utils);
const originalSyncSpawn = Utils.syncSpawn.bind(Utils);

export function initBashSpy (spyMocks: {cmd: string; returnValue: any}[]) {
    const spy = spyOn(Utils, "bash");

    spy.mockImplementation(async (cmd: string, cwd?: string) => {
        for (const spyMock of spyMocks) {
            if (cmd === spyMock.cmd) return spyMock.returnValue;
        }
        return originalBash(cmd, cwd);
    });

    return spy;
}

export function initSyncSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    const spy = spyOn(Utils, "syncSpawn");

    spy.mockImplementation((cmdArgs: string[], cwd?: string) => {
        for (const spyMock of spyMocks) {
            if (JSON.stringify(cmdArgs) === JSON.stringify(spyMock.cmdArgs)) {
                return spyMock.returnValue;
            }
        }
        return originalSyncSpawn(cmdArgs, cwd);
    });
}

let spawnResolveMocks: {cmdArgs: string[]; returnValue: any}[] = [];
let spawnRejectMocks: {cmdArgs: string[]; rejection: any}[] = [];

function rebuildSpawnSpy () {
    const resolves = [...spawnResolveMocks];
    const rejects = [...spawnRejectMocks];
    const spy = spyOn(Utils, "spawn");
    spy.mockImplementation(async (cmdArgs: string[], cwd?: string) => {
        const key = JSON.stringify(cmdArgs);
        for (const mock of rejects) {
            if (key === JSON.stringify(mock.cmdArgs)) throw mock.rejection;
        }
        for (let i = resolves.length - 1; i >= 0; i--) {
            if (key === JSON.stringify(resolves[i].cmdArgs)) return resolves[i].returnValue;
        }
        return originalSpawn(cmdArgs, cwd);
    });
    return spy;
}

export function initSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    spawnResolveMocks = spyMocks;
    spawnRejectMocks = [];
    return rebuildSpawnSpy();
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    spawnRejectMocks = spyMocks;
    return rebuildSpawnSpy();
}
