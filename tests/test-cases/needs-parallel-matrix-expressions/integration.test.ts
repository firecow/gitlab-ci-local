import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("needs-parallel-matrix-expressions <linux:test: [aws,monitoring]> array-form expression resolves 1:1", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["linux:test: [aws,monitoring]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-aws-monitoring",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,monitoring]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright linux:test: [aws,monitoring]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,app1]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,monitoring]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,app1]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-expressions <linux:test: [gcp,app1]> a different permutation resolves 1:1", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["linux:test: [gcp,app1]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-gcp-app1",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,app1]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright linux:test: [gcp,app1]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,monitoring]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,app1]}`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,monitoring]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-expressions <linux:test-array: [aws,monitoring]> array-form expression resolves 1:1", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["linux:test-array: [aws,monitoring]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-array-aws-monitoring",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,monitoring]     }`,
        chalk`{black.bgGreenBright  PASS } {blueBright linux:test-array: [aws,monitoring]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,app1]           }`,
    ]));
});

test.concurrent("needs-parallel-matrix-expressions <test-hyphen: [foo]> hyphenated matrix identifier resolves correctly", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["test-hyphen: [foo]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-hyphen-foo",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-hyphen: [foo]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-hyphen: [foo]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-hyphen: [bar]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-expressions <test-concat: [aws,monitoring]> multiple expressions concatenated in one string resolve correctly", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["test-concat: [aws,monitoring]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-concat-aws-monitoring",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-concat: [build-aws-monitoring]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-concat: [aws,monitoring]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright build-concat: [build-gcp-app1]}`,
    ]));
});

test.concurrent("needs-parallel-matrix-expressions <test-whitespace: [aws,monitoring]> whitespace variations parse equivalently", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["test-whitespace: [aws,monitoring]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-whitespace-aws-monitoring",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,monitoring]    }`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-whitespace: [aws,monitoring]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,app1]          }`,
    ]));
});

test.concurrent("needs-parallel-matrix-expressions <linux:test-mixed: [aws,monitoring]> mixed literal+expression keeps PROVIDER bound, broadens STACK", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions",
        job: ["linux:test-mixed: [aws,monitoring]"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-expressions-mixed-aws-monitoring",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,monitoring]     }`,
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [aws,app1]           }`,
        chalk`{black.bgGreenBright  PASS } {blueBright linux:test-mixed: [aws,monitoring]}`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,monitoring]     }`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{black.bgGreenBright  PASS } {blueBright linux:build: [gcp,app1]           }`,
    ]));
});
