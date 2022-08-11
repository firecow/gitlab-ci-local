import {when} from "jest-when";
import {Utils} from "../../src/utils";

export function initBashSpyReject (spyMocks: {cmd: string; rejection: string}[]) {
    const spyOn = jest.spyOn(Utils, "bash");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmd, expect.any(String)).mockRejectedValue(new Error(spyMock.rejection));
    }
}

export function initBashSpy (spyMocks: {cmd: string; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "bash");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmd, expect.any(String)).mockResolvedValue(spyMock.returnValue);
    }
}

export function initSpawnSpy (spyMocks: {cmdArgs: string[]; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "spawn");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmdArgs, expect.any(String)).mockResolvedValue(spyMock.returnValue);
    }
}
