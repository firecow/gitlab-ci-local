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
    expect(mockProcessExit).toBeCalledTimes(1);
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
        ["[94mnpm-install        [39m  Install npm packages                           [33m.pre  [39m  on_success         \n"],
        ["[94mnpm-audit          [39m  Find security vulnerabilities in node_modules  [33mtest  [39m  on_success  warning  []\n"],
        ["[94mnpm-outdated       [39m  Find outdated packages in node_modules         [33mtest  [39m  on_success  warning  [[94mnpm-install[39m]\n"],
        ["[94mdocker-compose-up  [39m  Up docker-compose services                     [33mdeploy[39m  on_success         \n"],
        ["[94mdocker-compose-down[39m  Down docker-compose services                   [33m.post [39m  manual             \n"],
        ["[94mfailure-job        [39m  Job that fail, after script also fails         [33m.post [39m  on_success         \n"],
        ["[94mremote-only        [39m  Job only runs on remote                        [33m.post [39m  never              \n"],
        ["[94mremote-or-manual   [39m  Job only runs on remote or manually            [33m.post [39m  manual             \n"]
    ])

    mockProcessStdout.mockRestore();
    mockProcessStderr.mockRestore();
    mockProcessExit.mockRestore();
});
