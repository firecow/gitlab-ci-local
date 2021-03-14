import * as mockProcess from "jest-mock-process";
import * as defaultCmd from "../src/default-cmd";
import * as fs from "fs-extra";

jest.setTimeout(90000);

let mockProcessExit: any;
let mockProcessStdout: any;
let mockProcessStderr: any;

beforeEach(() => {
    mockProcessExit = mockProcess.mockProcessExit(new Error("Test exited"));
    mockProcessStdout = mockProcess.mockProcessStdout();
    mockProcessStderr = mockProcess.mockProcessStderr();
});

afterEach(() => {
    mockProcessStdout.mockClear();
    mockProcessStderr.mockClear();
    mockProcessExit.mockClear();
});

test('plain', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/plain',
    });

    expect(mockProcessStdout).toBeCalledTimes(22);
    expect(mockProcessStderr).toBeCalledTimes(3);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('plain-invalid-jobname', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/plain-invalid-jobname',
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith("[31mJobs cannot include spaces, yet! 'test job'[39m\n");
    }
});

test('plain <notfound>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/plain',
            job: 'notfound'
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[94mnotfound[39m[31m could not be found[39m\n");
        expect(mockProcessStdout).toBeCalledTimes(1);
        expect(mockProcessStderr).toBeCalledTimes(1);
    }
});

test('trigger', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/trigger',
    });

    expect(mockProcessStdout).toHaveBeenCalledWith("[94mtrigger_job[39m");
});


test('needs <build-job> --needs', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/needs',
        job: 'build-job',
        needs: true
    });

    expect(mockProcessStdout).toHaveBeenCalledWith("Test something\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('needs-invalid-stage <build-job> --needs', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/needs-invalid-stage',
            job: 'build-job',
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStdout).toBeCalledTimes(0);
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[94mtest-job[39m[31m is needed by [94mbuild-job[39m[31m, but it is in the same or a future stage[39m\n");
    }
});

test('needs-unspecified-job <build-job> --needs', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/needs-unspecified-job',
            job: 'test-job',
        });
    } catch (e) {
        expect(e.message).toBe("Test exited");
        expect(mockProcessStdout).toBeCalledTimes(0);
        expect(mockProcessStderr).toHaveBeenCalledWith("[31m[ [94minvalid[39m[31m ] jobs are needed by [94mtest-job[39m[31m, but they cannot be found[39m\n");
    }
});

test('image <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/image',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Test something\n");
});

test('image <test-entrypoint>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/image',
        job: 'test-entrypoint',
        privileged: true
    });

    expect(mockProcessStdout).toHaveBeenCalledWith("/\n");
    expect(mockProcessStdout).toHaveBeenCalledWith("Hello from 'firecow/gitlab-ci-local-test-image' image entrypoint\n");
    expect(mockProcessStdout).toHaveBeenCalledWith("/builds\n");
    expect(mockProcessStdout).toHaveBeenCalledWith("Test Entrypoint\n");
    expect(mockProcessStdout).toHaveBeenCalledWith("I'm a test file\n");

});

test('no-script <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/no-script',
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
        cwd: 'tests/test-cases/before-script',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Before test\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('before-script-default <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/before-script-default',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Before test\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('after-script <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/after-script',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Cleanup after test\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('after-script-default <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/after-script-default',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Cleanup after test\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('artifacts <test-root-file>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/artifacts',
        job: 'test-root-file'
    });
    expect(fs.existsSync("tests/test-cases/artifacts/log.txt")).toBe(true);
    expect(mockProcessExit).toBeCalledTimes(0);
    fs.unlinkSync("tests/test-cases/artifacts/log.txt");
});

test('artifacts <test-deep-file>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/artifacts',
        job: 'test-deep-file'
    });
    expect(fs.existsSync("tests/test-cases/artifacts/path/log.txt")).toBe(true);
    expect(mockProcessExit).toBeCalledTimes(0);
    fs.rmdirSync("tests/test-cases/artifacts/path", {recursive: true});
});

test('artifacts <test-deep-file-folder-only>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/artifacts',
        job: 'test-deep-file-folder-only'
    });
    expect(fs.existsSync("tests/test-cases/artifacts/bin/app.exe")).toBe(true);
    expect(mockProcessExit).toBeCalledTimes(0);
    fs.rmdirSync("tests/test-cases/artifacts/bin", {recursive: true});
});

test('artifacts <test-folder>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/artifacts',
        job: 'test-folder'
    });
    expect(fs.existsSync("tests/test-cases/artifacts/folder/log.txt")).toBe(true);
    expect(mockProcessExit).toBeCalledTimes(0);
    fs.rmdirSync("tests/test-cases/artifacts/folder", {recursive: true});
});

test('artifacts <test-deep-dir>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/artifacts',
        job: 'test-deep-dir'
    });
    expect(fs.existsSync("tests/test-cases/artifacts/dir/deep/log.txt")).toBe(true);
    expect(mockProcessExit).toBeCalledTimes(0);
    fs.rmdirSync("tests/test-cases/artifacts/dir", {recursive: true});
});

test('artifacts-no-globstar', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/artifacts-no-globstar'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith("[31mArtfact paths cannot contain globstar, yet! 'test-job'[39m\n");
        expect(e.message).toBe("Test exited");
    }
});

test('dotenv <test-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/dotenv',
        job: 'test-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Test something\n");
});

test('extends', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/extends'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Test something\n");
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('include <build-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/include',
            job: 'build-job'
        });
        expect(mockProcessStdout).toHaveBeenCalledWith("Build something\n");
        expect(mockProcessExit).toBeCalledTimes(0);
    } catch(e) {
        console.log(mockProcessStderr.mock.calls.join("\n"));
        console.log(e);
    }
});

test('include <deploy-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/include',
        job: 'deploy-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("Deploy something\n");
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('manual <build-job>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/manual',
        manual: 'build-job'
    });
    expect(mockProcessStdout).toHaveBeenCalledWith("[35mnot started[39m ");
    expect(mockProcessStdout).toHaveBeenCalledWith("[94mtest-job[39m");
    expect(mockProcessStdout).toHaveBeenCalledWith("[32msuccessful[39m ");
    expect(mockProcessStdout).toHaveBeenCalledWith("[94mbuild-job[39m");
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('script-failures <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/script-failures',
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
            cwd: 'tests/test-cases/script-failures',
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
        cwd: 'tests/test-cases/script-failures',
        job: 'allow-failure-job',
    });

    expect(mockProcessStdout).toHaveBeenCalledWith("[93mwarning[39m ");
    expect(mockProcessStderr).toBeCalledTimes(1);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('script-failures <allow-failure-after-scripts>', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/script-failures',
        job: 'allow-failure-after-script',
    });

    expect(mockProcessStdout).toHaveBeenCalledWith("[93mwarning[39m ");
    expect(mockProcessStderr).toBeCalledTimes(2);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('stage-not-found <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/stage-not-found',
            job: 'test-job'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m[33mstage:invalid[39m[31m not found for [94mtest-job[39m[31m[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('invalid-variables-bool <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/invalid-variables-bool',
            job: 'test-job'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m[94mtest-job[39m[31m has invalid variables hash of key value pairs. INVALID=true[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('invalid-variables-null <test-job>', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/invalid-variables-null',
            job: 'test-job'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m[94mtest-job[39m[31m has invalid variables hash of key value pairs. INVALID=null[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('invalid-stages', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/invalid-stages',
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31m[33mstages:[39m[31m must be an array[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('no-git-config', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'tests/test-cases/no-git-config',
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31mCould not locate.gitconfig or .git/config file[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('list --list', async () => {
    await defaultCmd.handler({
        cwd: 'tests/test-cases/list-case/',
        list: true
    });

    expect(mockProcessStdout).toHaveBeenCalledWith("[94mtest-job [39m  Run Tests  [33mtest [39m  on_success         \n");
    expect(mockProcessStdout).toHaveBeenCalledWith("[94mbuild-job[39m             [33mbuild[39m  on_success  warning  [[94mtest-job[39m]\n");
    expect(mockProcessStderr).toBeCalledTimes(0);
    expect(mockProcessExit).toBeCalledTimes(0);
});

test('--cwd unknown-directory/', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'something/unknown-directory'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31msomething/unknown-directory is not a directory[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});

test('--cwd docs/', async () => {
    try {
        await defaultCmd.handler({
            cwd: 'docs'
        });
    } catch (e) {
        expect(mockProcessStderr).toHaveBeenCalledWith(`[31mdocs does not contain .gitlab-ci.yml[39m\n`);
        expect(e.message).toBe("Test exited");
    }
});
