import {spyOn, expect} from "bun:test";
import {Utils} from "../../src/utils.js";

const originalBash = Utils.bash.bind(Utils);
const originalSpawn = Utils.spawn.bind(Utils);
const originalSyncSpawn = Utils.syncSpawn.bind(Utils);

function matches (actual: any, expected: any): boolean {
    try {
        expect(actual).toEqual(expected);
        return true;
    } catch {
        return false;
    }
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
            if (matches(cmd, spyMock.cmd)) return spyMock.returnValue;
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
            if (matches(cmdArgs, spyMock.cmdArgs)) return spyMock.returnValue;
        }
        return originalSyncSpawn(cmdArgs, cwd);
    });
    return spy;
}

async function spawnMockImpl (cmdArgs: string[], cwd?: string) {
    for (const mock of spawnRejectMocks) {
        if (matches(cmdArgs, mock.cmdArgs)) throw mock.rejection;
    }
    for (let i = spawnResolveMocks.length - 1; i >= 0; i--) {
        if (matches(cmdArgs, spawnResolveMocks[i].cmdArgs)) return spawnResolveMocks[i].returnValue;
    }
    return originalSpawn(cmdArgs, cwd);
}

export function initSpawnSpy (spyMocks: {cmdArgs: any[]; returnValue: any}[]) {
    spawnResolveMocks = spyMocks;
    spawnRejectMocks = [];
    const spy = spyOn(Utils, "spawn");
    spy.mockImplementation(spawnMockImpl);
    return spy;
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    spawnRejectMocks = spyMocks;
    const spy = spyOn(Utils, "spawn");
    spy.mockImplementation(spawnMockImpl);
    return spy;
}
