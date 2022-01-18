import {when} from "jest-when";
import {Utils} from "../../src/utils";

export function initSpawnSpy(spyMocks: {cmd: string; returnValue: any}[]) {
    const spyOn = jest.spyOn(Utils, "spawn");

    for (const spyMock of spyMocks) {
        when(spyOn).calledWith(spyMock.cmd, expect.any(String)).mockResolvedValue(spyMock.returnValue);
    }
}

export function initSpawnMock(spawnMocks: {cmd: string; returnValue: any; exitCode?: number}[]) {
    const mock = jest.fn();

    for (const spawnMock of spawnMocks) {
        if (spawnMock.exitCode && spawnMock.exitCode > 0) {
            when(mock).mockRejectedValue("Fatal error");
        } else {
            when(mock).calledWith(spawnMock.cmd, expect.any(String)).mockResolvedValue(spawnMock.returnValue);
        }
    }

    Utils.spawn = mock;
}
