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
