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

test('docker-compose example list', async() => {
    const mockProcessStdout = mockProcess.mockProcessStdout();
    const mockProcessStderr = mockProcess.mockProcessStderr();
    const mockProcessExit = mockProcess.mockProcessExit();

    await defaultCmd.handler({
        cwd: 'examples/docker-compose-nodejs',
        list: true
    });
    expect(mockProcessExit).toBeCalledTimes(0);
    expect(mockProcessStdout.mock.calls).toEqual([
        ["\u001b[94mnpm-install        \u001b[39m  Install npm packages                           \u001b[33m.pre  \u001b[39m  on_success         \n"],
        ["\u001b[94mnpm-audit          \u001b[39m  Find security vulnerabilities in node_modules  \u001b[33mtest  \u001b[39m  on_success  warning  []\n"],
        ["\u001b[94mnpm-outdated       \u001b[39m  Find outdated packages in node_modules         \u001b[33mtest  \u001b[39m  on_success  warning  [\u001b[94mnpm-install\u001b[39m]\n"],
        ["\u001b[94mdocker-compose-up  \u001b[39m  Up docker-compose services                     \u001b[33mdeploy\u001b[39m  on_success         \n"],
        ["\u001b[94mdocker-compose-down\u001b[39m  Down docker-compose services                   \u001b[33m.post \u001b[39m  manual             \n"]
    ])

    mockProcessStdout.mockRestore();
    mockProcessStderr.mockRestore();
    mockProcessExit.mockRestore();
});
