import {Utils} from "../utils";
import * as mockProcess from 'jest-mock-process';

test('Print to stdout', () => {
    const mockStdout = mockProcess.mockProcessStdout();
    Utils.printToStream("Hello, world!", 'stdout');
    expect(mockStdout).toHaveBeenCalledWith('Hello, world!\n');
    mockStdout.mockRestore();
});

test('Print to stderr', () => {
    const mockStderr = mockProcess.mockProcessStderr();
    Utils.printToStream("Hello, world!", 'stderr');
    expect(mockStderr).toHaveBeenCalledWith('[31mHello, world![39m\n');
    mockStderr.mockRestore();
});

test('Print job on index 0', () => {
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
