import {spyOn} from "bun:test";
import {Utils} from "../../src/utils.js";

const originalBash = Utils.bash.bind(Utils);
const originalSpawn = Utils.spawn.bind(Utils);
const originalSyncSpawn = Utils.syncSpawn.bind(Utils);

function matchValue (actual: any, expected: any): boolean {
    if (expected != null && typeof expected === "object" && typeof expected.asymmetricMatch === "function") {
        return expected.asymmetricMatch(actual);
    }
    return actual === expected;
}

function matchArgs (actual: any[], expected: any[]): boolean {
    if (actual.length !== expected.length) return false;
    return expected.every((e, i) => matchValue(actual[i], e));
}

let bashMocks: {cmd: any; returnValue: any}[] = [];
let syncSpawnMocks: {cmdArgs: string[]; returnValue: any}[] = [];
let spawnResolveMocks: {cmdArgs: any[]; returnValue: any}[] = [];
let spawnRejectMocks: {cmdArgs: any[]; rejection: any}[] = [];

export function initBashSpy (spyMocks: {cmd: any; returnValue: any}[]) {
    bashMocks = spyMocks;
    const spy = spyOn(Utils, "bash");
    spy.mockImplementation(async (cmd: string, cwd?: string) => {
        for (const spyMock of bashMocks) {
            if (matchValue(cmd, spyMock.cmd)) return spyMock.returnValue;
        }
        return originalBash(cmd, cwd);
    });
    return spy;
}

export function initSyncSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    syncSpawnMocks = spyMocks;
    const spy = spyOn(Utils, "syncSpawn");
    spy.mockImplementation((cmdArgs: string[], cwd?: string) => {
        for (const spyMock of syncSpawnMocks) {
            if (matchArgs(cmdArgs, spyMock.cmdArgs)) return spyMock.returnValue;
        }
        return originalSyncSpawn(cmdArgs, cwd);
    });
    return spy;
}

export function initSpawnSpy (spyMocks: {cmdArgs: any[]; returnValue: any}[]) {
    spawnResolveMocks = spyMocks;
    spawnRejectMocks = [];
    const spy = spyOn(Utils, "spawn");
    spy.mockImplementation(async (cmdArgs: string[], cwd?: string) => {
        for (const mock of spawnRejectMocks) {
            if (matchArgs(cmdArgs, mock.cmdArgs)) throw mock.rejection;
        }
        for (let i = spawnResolveMocks.length - 1; i >= 0; i--) {
            if (matchArgs(cmdArgs, spawnResolveMocks[i].cmdArgs)) return spawnResolveMocks[i].returnValue;
        }
        return originalSpawn(cmdArgs, cwd);
    });
    return spy;
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    spawnRejectMocks = spyMocks;
    const spy = spyOn(Utils, "spawn");
    spy.mockImplementation(async (cmdArgs: string[], cwd?: string) => {
        for (const mock of spawnRejectMocks) {
            if (matchArgs(cmdArgs, mock.cmdArgs)) throw mock.rejection;
        }
        for (let i = spawnResolveMocks.length - 1; i >= 0; i--) {
            if (matchArgs(cmdArgs, spawnResolveMocks[i].cmdArgs)) return spawnResolveMocks[i].returnValue;
        }
        return originalSpawn(cmdArgs, cwd);
    });
    return spy;
}
