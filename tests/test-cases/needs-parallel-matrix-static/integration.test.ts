import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("needs-parallel-matrix-static <test-single> only triggers build-job: [foo]", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-static",
        job: ["test-single"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-static-single",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [foo]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-single}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [bar]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [beb]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-static <test-array> triggers build-job: [foo] and [bar] only", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-static",
        job: ["test-array"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-static-array",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [foo]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [bar]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-array}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [beb]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-static <test-partial> partial selector matches both OS permutations of ARCH=x64", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-static",
        job: ["test-partial"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-static-partial",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [x64,linux]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [x64,mac]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-partial}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [arm,linux]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [arm,mac]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-static <test-full> full multi-key selector picks one permutation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-static",
        job: ["test-full"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-static-full",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [x64,linux]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-full  }`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [x64,mac]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [arm,linux]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-multi: [arm,mac]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-static <test-optional-zero> optional selector matching nothing runs consumer alone", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-static",
        job: ["test-optional-zero"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-static-optional-zero",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright test-optional-zero}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-job: [foo]}`,
    ]));
});
