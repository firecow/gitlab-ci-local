import {when} from "jest-when";
import {Utils} from "../../src/utils.js";

export function initBashSpyReject (spyMocks: {cmd: string; rejection: any}[]) {
    const spyOn = jest.spyOn(Utils, "bash");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmd, expect.any(String)).mockRejectedValue(spyMock.rejection);
        when(spyOn).calledWith(spyMock.cmd).mockRejectedValue(spyMock.rejection);
    }
}

export function initBashSpy (spyMocks: {cmd: string; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "bash");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmd, expect.any(String)).mockResolvedValue(spyMock.returnValue);
        when(spyOn).calledWith(spyMock.cmd).mockResolvedValue(spyMock.returnValue);
    }

    return spyOn;
}

export function initSyncSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "syncSpawn");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmdArgs, expect.any(String)).mockReturnValue(spyMock.returnValue);
        when(spyOn).calledWith(spyMock.cmdArgs).mockReturnValue(spyMock.returnValue);
    }
}

export function initSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "spawn");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmdArgs, expect.any(String)).mockResolvedValue(spyMock.returnValue);
        when(spyOn).calledWith(spyMock.cmdArgs).mockResolvedValue(spyMock.returnValue);
    }

    return spyOn;
}

export function initSpawnSpyReject (spyMocks: {cmdArgs: string[]; rejection: any}[]) {
    const spyOn = jest.spyOn(Utils, "spawn");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmdArgs, expect.any(String)).mockRejectedValue(spyMock.rejection);
    }
}
