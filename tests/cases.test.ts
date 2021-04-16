import {MockWriteStreams} from "../src/mock-write-streams";
import * as chalk from "chalk";
import {handler} from "../src/handler";

test("plain", async () => {
    const writeStream = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/plain",
    }, writeStream);

    expect(writeStream.stdoutLines.length).toEqual(15);
    expect(writeStream.stderrLines.length).toEqual(1);
});

test("invalid-jobname", async () => {
    const mockWriteStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/invalid-jobname",
        }, mockWriteStreams);
    } catch (e) {
        expect(e.message).toBe("Jobs cannot include spaces, yet! 'test job'");
    }
});

test("plain <notfound>", async () => {
    const mockWriteStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/plain",
            job: "notfound"
        }, mockWriteStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright notfound} could not be found`);
    }
});

test("trigger", async () => {
    const mockWriteStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/trigger",
    }, mockWriteStreams);

    const expected = [chalk`{green successful} {blueBright pipe-gen-job}, {blueBright trigger_job}`];
    expect(mockWriteStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("needs <build-job> --needs", async () => {
    const mockWriteStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs",
        job: "build-job",
        needs: true
    }, mockWriteStreams);

    const expected = [chalk`{blueBright test-job } {greenBright >} Test something`];
    expect(mockWriteStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("needs-invalid-stage <build-job> --needs", async () => {
    const mockWriteStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/needs-invalid-stage",
            job: "build-job",
        }, mockWriteStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} is needed by {blueBright build-job}, but it is in the same or a future stage`);
    }
});

test("needs-unspecified-job <build-job> --needs", async () => {
    const mockWriteStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/needs-unspecified-job",
            job: "test-job",
        }, mockWriteStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`[ {blueBright invalid} ] jobs are needed by {blueBright test-job}, but they cannot be found`);
    }
});

test("custom-home <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: "test-job",
        home: "tests/test-cases/custom-home/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} group-global-var-override-value`,
        chalk`{blueBright test-job} {greenBright >} project-group-var-override-value`,
        chalk`{blueBright test-job} {greenBright >} project-var-value`,
        chalk`{blueBright test-job} {greenBright >} Im content of a file variable`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: "test-job"
    }, writeStreams);
    const expected = [chalk`{blueBright test-job                } {greenBright >} Test something`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-entrypoint>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: "test-entrypoint",
        privileged: true
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint         } {greenBright >} Hello from 'firecow/gitlab-ci-local-test-image' image entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} I am epic multiline value`,
        chalk`{blueBright test-entrypoint         } {greenBright >} /builds`,
        chalk`{blueBright test-entrypoint         } {greenBright >} Test Entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} I'm a test file`
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-entrypoint-override>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: "test-entrypoint-override"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint-override} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("no-script <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/no-script",
            job: "test-job"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} must have script specified`);
    }
});

test("before-script <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/before-script",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Before test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("script-multidimension <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-multidimension",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
        chalk`{blueBright test-job} {greenBright >} Test something else`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("before-script-default <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/before-script-default",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Before test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("after-script <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Cleanup after test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("after-script-default <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/after-script-default",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Cleanup after test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("artifacts <consume-artifacts> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts",
        job: "consume-artifacts",
        needs: true
    }, writeStreams);

    expect(writeStreams.stderrLines.length).toBe(0);
});

test("artifacts-no-globstar", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/artifacts-no-globstar"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe("Artfact paths cannot contain globstar, yet! 'test-job'");
    }
});

test("cache <consume-cache> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache",
        job: "consume-cache",
        needs: true
    }, writeStreams);

    expect(writeStreams.stderrLines.length).toBe(0);
});

test("dotenv <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/dotenv",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("extends <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/extends",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something (before_script)`,
        chalk`{blueBright test-job} {greenBright >} Test something`,
        chalk`{blueBright test-job} {greenBright >} Test something (after_script)`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("include <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/include",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job  } {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("include <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/include",
        job: "build-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job } {greenBright >} Build something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});
//
test("include <deploy-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/include",
        job: "deploy-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("include-template <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/include-template",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test Something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("manual <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual",
        manual: "build-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Hello, build job manual!`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("reference <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/reference",
        job: "test-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Setting something general up`,
        chalk`{blueBright test-job} {greenBright >} Yoyo`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("script-failures <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "test-job",
    }, writeStreams);

    const expected = [
        chalk`{red failure} {blueBright test-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <test-job-after-script>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "test-job-after-script",
    }, writeStreams);

    const expected = [
        chalk`{yellowBright after script} {blueBright test-job-after-script}`,
        chalk`{red failure} {blueBright test-job-after-script}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <allow-failure-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "allow-failure-job",
    }, writeStreams);

    const expected = [
        chalk`{yellowBright warning} {blueBright allow-failure-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <allow-failure-after-scripts>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "allow-failure-after-script",
    }, writeStreams);

    const expected = [
        chalk`{yellowBright warning} {blueBright allow-failure-after-script}`,
        chalk`{yellowBright after script} {blueBright allow-failure-after-script}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("stage-not-found <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/stage-not-found",
            job: "test-job"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{yellow stage:invalid} not found for {blueBright test-job}`);
    }
});

test("invalid-variables-bool <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/invalid-variables-bool",
            job: "test-job"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} has invalid variables hash of key value pairs. INVALID=true`);
    }
});

test("invalid-variables-null <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/invalid-variables-null",
            job: "test-job"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} has invalid variables hash of key value pairs. INVALID=null`);
    }
});

test("invalid-stages", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/invalid-stages",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{yellow stages:} must be an array`);
    }
});

test("no-git-config", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/no-git-config",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe("Could not locate.gitconfig or .git/config file");
    }
});

test("list-case --list", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/list-case/",
        list: true
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job }  Run Tests  {yellow test }  on_success         `,
        chalk`{blueBright build-job}             {yellow build}  on_success  warning  [{blueBright test-job}]`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("--cwd unknown-directory/", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "something/unknown-directory"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`something/unknown-directory is not a directory`);
    }
});

test("--cwd docs/", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "docs"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`docs does not contain .gitlab-ci.yml`);
    }
});
