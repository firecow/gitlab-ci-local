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

function rebuildBashSpy () {
    const mocks = [...bashMocks];
    const spy = spyOn(Utils, "bash");
    spy.mockImplementation(async (cmd: string, cwd?: string) => {
        for (const spyMock of mocks) {
            if (matchValue(cmd, spyMock.cmd)) return spyMock.returnValue;
        }
        return originalBash(cmd, cwd);
    });
    return spy;
}

export function initBashSpy (spyMocks: {cmd: any; returnValue: any}[]) {
    bashMocks = spyMocks;
    return rebuildBashSpy();
}

let syncSpawnMocks: {cmdArgs: string[]; returnValue: any}[] = [];

function rebuildSyncSpawnSpy () {
    const mocks = [...syncSpawnMocks];
    const spy = spyOn(Utils, "syncSpawn");
    spy.mockImplementation((cmdArgs: string[], cwd?: string) => {
        for (const spyMock of mocks) {
            if (matchArgs(cmdArgs, spyMock.cmdArgs)) {
                return spyMock.returnValue;
            }
        }
        return originalSyncSpawn(cmdArgs, cwd);
    });
    return spy;
}

export function initSyncSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    syncSpawnMocks = spyMocks;
    return rebuildSyncSpawnSpy();
}

let spawnResolveMocks: {cmdArgs: any[]; returnValue: any}[] = [];
let spawnRejectMocks: {cmdArgs: any[]; rejection: any}[] = [];

function rebuildSpawnSpy () {
    const resolves = [...spawnResolveMocks];
    const rejects = [...spawnRejectMocks];
    const spy = spyOn(Utils, "spawn");
    spy.mockImplementation(async (cmdArgs: string[], cwd?: string) => {
        for (const mock of rejects) {
            if (matchArgs(cmdArgs, mock.cmdArgs)) throw mock.rejection;
        }
        for (let i = resolves.length - 1; i >= 0; i--) {
            if (matchArgs(cmdArgs, resolves[i].cmdArgs)) return resolves[i].returnValue;
        }
        return originalSpawn(cmdArgs, cwd);
    });
    return spy;
}

export function initSpawnSpy (spyMocks: {cmdArgs: any[]; returnValue: any}[]) {
    spawnResolveMocks = spyMocks;
    spawnRejectMocks = [];
    // Reset bash and syncSpawn mocks to prevent cross-file contamination
    bashMocks = [];
    rebuildBashSpy();
    syncSpawnMocks = [];
    rebuildSyncSpawnSpy();
    return rebuildSpawnSpy();
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    spawnRejectMocks = spyMocks;
    return rebuildSpawnSpy();
}
