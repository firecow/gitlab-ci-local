import {when} from "jest-when";
import {Utils} from "../../src/utils";

export function initBashSpy(spyMocks: {cmd: string; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "bash");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmd, expect.any(String)).mockResolvedValue(spyMock.returnValue);
    }
}

export function initSpawnSpy(spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "spawn");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmdArgs, expect.any(String)).mockResolvedValue(spyMock.returnValue);
    }
}

export function initSpawnMock(spawnMocks: {cmdArgs: string[]; returnValue: any}[]) {
    const mock = jest.fn();

    for (const spawnMock of spawnMocks) {
        when(mock).calledWith(spawnMock.cmdArgs, expect.any(String)).mockResolvedValue(spawnMock.returnValue);
    }

    Utils.spawn = mock;
}
