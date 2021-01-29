import * as mockProcess from "jest-mock-process";
import * as defaultCmd from "../default-cmd";

const mockProcessExit = mockProcess.mockProcessExit(new Error("Test exited"));
const mockProcessStdout = mockProcess.mockProcessStdout();
const mockProcessStderr = mockProcess.mockProcessStderr();

afterEach(() => {
    mockProcessStdout.mockClear();
    mockProcessStderr.mockClear();
    mockProcessExit.mockClear();
});

test('plain', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/plain',
    });

    expect(mockProcessStdout).toBeCalledTimes(25);
    expect(mockProcessStderr).toBeCalledTimes(3);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('plain <notfound>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/plain',
            job: 'notfound'
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[94mnotfound[39m[31m could not be found[39m\n");
        expect(mockProcessStdout).toBeCalledTimes(0);
        expect(mockProcessStderr).toBeCalledTimes(1);
    }
});

test('needs <build-job> --needs', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/needs',
        job: 'build-job',
        needs: true
    });

    expect(mockProcessStdout).toBeCalledTimes(19);
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('needs-invalid-stage <build-job> --needs', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/needs-invalid-stage',
            job: 'build-job',
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStdout).toBeCalledTimes(0);
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[94mbuild-job[39m[31m cannot need job from same/future stage. needs: [94mtest-job[39m[31m[39m\n");
    }
});

test('needs-unspecified-job <build-job> --needs', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/needs-unspecified-job',
            job: 'test-job',
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStdout).toBeCalledTimes(0);
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[94mtest-job[39m[31m cannot need unspecified jobs[39m\n");
    }
});

test('image <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/image',
        job: 'test-job'
    });

    expect(mockProcessStdout).toHaveBeenCalledWith('[94mtest-job[39m [95mstarting[39m [95min docker...[39m\n');
    expect(mockProcessStdout).toBeCalledTimes(11);
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('no-script <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/no-script',
            job: 'test-job'
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStdout).toBeCalledTimes(0);
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[94mtest-job[39m[31m must have script specified[39m\n");
    }
});

test('before-script <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/before-script',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Before test\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('after-script <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/after-script',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Cleanup after test\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('artifacts <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/artifacts',
        job: 'test-job'
    });
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('include <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/include',
        job: 'build-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Build something\n");
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('manual <build-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/manual',
        manual: 'build-job'
    });
    expect(mockProcessStdout).toHaveBeenNthCalledWith(14, "[35mnot started[39m ");
    expect(mockProcessStdout).toHaveBeenNthCalledWith(15, "[94mtest-job[39m");
    expect(mockProcessStdout).toHaveBeenNthCalledWith(17, "[32msuccessful[39m ");
    expect(mockProcessStdout).toHaveBeenNthCalledWith(18, "[94mbuild-job[39m");
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('script-failures <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/script-failures',
            job: 'test-job',
        });
    } catch (e) {
        expect(mockProcessStdout).toBeCalledTimes(19);
        expect(mockProcessStderr).toBeCalledTimes(2);
        expect(e.message).toBe("Test exited");
    }
});

test('script-failures <test-job-after-script>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/script-failures',
            job: 'test-job-after-script',
        });
    } catch (e) {
        expect(mockProcessStdout).toBeCalledTimes(19);
        expect(mockProcessStderr).toBeCalledTimes(2);
        expect(e.message).toBe("Test exited");
    }
});

test('script-failures <allow-failure-job>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/script-failures',
        job: 'allow-failure-job',
    });

    expect(mockProcessStdout).toBeCalledTimes(7);
    expect(mockProcessStderr).toBeCalledTimes(1);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('script-failures <allow-failure-after-scripts>', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/script-failures',
        job: 'allow-failure-after-script',
    });

    expect(mockProcessStdout).toBeCalledTimes(13);
    expect(mockProcessStderr).toBeCalledTimes(2);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('stage-not-found <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/stage-not-found',
            job: 'test-job'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m[33mstage:invalid[39m[31m not found for [94mtest-job[39m[31m[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('invalid-stages', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'src/tests/test-cases/invalid-stages',
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m[33mstages:[39m[31m must be an array[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('plain --list', async () => {
    await defaultCmd.handler({
        cwd: 'src/tests/test-cases/plain',
        list: true
    });

    expect(mockProcessStdout.mock.calls).toEqual([
        ["[94mtest-job [39m  Run Tests  [33mtest [39m  on_success         \n"],
        ["[94mbuild-job[39m             [33mbuild[39m  on_success         \n"],
    ]);
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('--cwd unknown-directory/', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'unknown-directory'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m${process.cwd()}/unknown-directory is not a directory[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('--cwd docs/', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'docs'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m${process.cwd()}/docs does not contain .gitlab-ci.yml[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});
