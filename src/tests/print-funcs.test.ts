import * as mockProcess from 'jest-mock-process';
import {Utils} from "../utils";

test('Print job on first index', () => {
    const mockStdout = mockProcess.mockProcessStdout();
    Utils.printJobNames({name: "Hello"}, 0, [{name: "Hello"}, {name: "Hello"}, {name: "Hello"}]);
    expect(mockStdout).toHaveBeenCalledWith('[94mHello[39m, ');
    mockStdout.mockRestore();
});

test('Print job on last index', () => {
    const mockStdout = mockProcess.mockProcessStdout();
    Utils.printJobNames({name: "Hello"}, 2, [{name: "Hello"}, {name: "Hello"}, {name: "Hello"}]);
    expect(mockStdout).toHaveBeenCalledWith('[94mHello[39m');
    mockStdout.mockRestore();
});
