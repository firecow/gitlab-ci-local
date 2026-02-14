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

// Create spies once at module load, reading from module-level state
const bashSpy = spyOn(Utils, "bash");
bashSpy.mockImplementation(async (cmd: string, cwd?: string) => {
    for (const spyMock of bashMocks) {
        if (matchValue(cmd, spyMock.cmd)) return spyMock.returnValue;
    }
    return originalBash(cmd, cwd);
});

const syncSpawnSpy = spyOn(Utils, "syncSpawn");
syncSpawnSpy.mockImplementation((cmdArgs: string[], cwd?: string) => {
    for (const spyMock of syncSpawnMocks) {
        if (matchArgs(cmdArgs, spyMock.cmdArgs)) return spyMock.returnValue;
    }
    return originalSyncSpawn(cmdArgs, cwd);
});

const spawnSpy = spyOn(Utils, "spawn");
spawnSpy.mockImplementation(async (cmdArgs: string[], cwd?: string) => {
    for (const mock of spawnRejectMocks) {
        if (matchArgs(cmdArgs, mock.cmdArgs)) throw mock.rejection;
    }
    for (let i = spawnResolveMocks.length - 1; i >= 0; i--) {
        if (matchArgs(cmdArgs, spawnResolveMocks[i].cmdArgs)) return spawnResolveMocks[i].returnValue;
    }
    return originalSpawn(cmdArgs, cwd);
});

export function initBashSpy (spyMocks: {cmd: any; returnValue: any}[]) {
    bashMocks = spyMocks;
    return bashSpy;
}

export function initSyncSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    syncSpawnMocks = spyMocks;
    return syncSpawnSpy;
}

export function initSpawnSpy (spyMocks: {cmdArgs: any[]; returnValue: any}[]) {
    spawnResolveMocks = spyMocks;
    spawnRejectMocks = [];
    bashMocks = [];
    syncSpawnMocks = [];
    return spawnSpy;
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    spawnRejectMocks = spyMocks;
    return spawnSpy;
}
