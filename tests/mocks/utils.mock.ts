import {vi, expect} from "vitest";
import {Shell} from "../../src/shell.js";

const originalBash = Shell.bash.bind(Shell);
const originalSpawn = Shell.spawn.bind(Shell);
const originalSyncSpawn = Shell.syncSpawn.bind(Shell);

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
    const spy = vi.spyOn(Shell, "bash");
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
    const spy = vi.spyOn(Shell, "syncSpawn");
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
    const spy = vi.spyOn(Shell, "spawn");
    spy.mockImplementation(spawnMockImpl);
    return spy;
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    spawnRejectMocks = spyMocks;
    const spy = vi.spyOn(Shell, "spawn");
    spy.mockImplementation(spawnMockImpl);
    return spy;
}
