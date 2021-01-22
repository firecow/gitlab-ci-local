import * as defaultCmd from "../default_cmd";
import * as mockProcess from "jest-mock-process";

jest.setTimeout(90000);

test('docker-compose-nodejs pipeline', async() => {

    const mockProcessStdout = mockProcess.mockProcessStdout();
    const mockProcessStderr = mockProcess.mockProcessStderr();
    const mockProcessExit = mockProcess.mockProcessExit();

    await defaultCmd.handler({
        cwd: 'examples/docker-compose-nodejs',
        manual: 'docker-compose-down'
    });
    expect(mockProcessExit).toBeCalledTimes(0);
    expect(mockProcessStderr).toHaveBeenCalledWith("Dependencies not up-to-date\n")
    expect(mockProcessStdout).toHaveBeenCalledWith("[94mdocker-compose-up[39m environment: { name: [1mlocal[22m, url: [1mhttp://localhost:8891[22m }\n");

    mockProcessStdout.mockRestore();
    mockProcessStderr.mockRestore();
    mockProcessExit.mockRestore();
});

test('docker-compose example single job', async() => {
    const mockProcessStdout = mockProcess.mockProcessStdout();
    const mockProcessStderr = mockProcess.mockProcessStderr();
    const mockProcessExit = mockProcess.mockProcessExit();

    await defaultCmd.handler({
        cwd: 'examples/docker-compose-nodejs',
        job: 'npm-outdated',
        needs: true
    });
    expect(mockProcessExit).toBeCalledTimes(0);
    expect(mockProcessStderr).toHaveBeenCalledWith("Dependencies not up-to-date\n")

    mockProcessStdout.mockRestore();
    mockProcessStderr.mockRestore();
    mockProcessExit.mockRestore();
});
