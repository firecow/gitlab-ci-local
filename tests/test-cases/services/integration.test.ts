import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("services <pre-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["pre-job"],
    }, writeStreams);

    const expectedStdErr = [
        chalk`{blueBright pre-job} {yellow Could not find exposed tcp ports docker.io/library/alpine:latest}`,
        chalk`{blueBright pre-job} {redBright >} cat: can't open '/foo.txt': No such file or directory`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expectedStdErr));
});

test.concurrent("services <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Host docker.io-library-nginx not found: 3(NXDOMAIN)`,
        chalk`{black.bgRed  FAIL } {blueBright test-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const expectedStdErr = [
        chalk`{blueBright test-job} {yellow Could not find exposed tcp ports docker.io/library/alpine:latest}`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expectedStdErr));
});

test.concurrent("services <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright build-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <deploy-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["deploy-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright deploy-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <multiport-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["multiport-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright multiport-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
}, 120000);

test.concurrent("services <alias-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["alias-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright alias-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <alias-job-multiple-slashes>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["alias-job-multiple-slashes"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright alias-job-multiple-slashes}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <multie-job>", async () => {
    await fs.promises.rm("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-0.log", {force: true});
    await fs.promises.rm("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-1.log", {force: true});
    await fs.promises.rm("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-2.log", {force: true});

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["multie-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/Hello/);
    expect(await fs.pathExists("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-0.log")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-1.log")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-2.log")).toEqual(true);
    expect(await fs.readFile("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-0.log", "utf-8")).toMatch(/sh: line 0: echo Service 1: not found/);
    expect(await fs.readFile("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/docker.io/library/alpine:latest-2.log", "utf-8")).toMatch(/Service 3/);
});

test.concurrent("services <no-tmp>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["no-tmp"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright no-tmp}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <services:entrypoint should support variable expansion and double quotes>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        file: ".gitlab-ci-2.yml",
        noColor: true,
    }, writeStreams);

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("job1 >")).join("\n");
    expect(filteredStdout).toEqual(`
job1 > should support single quote       [']
job1 > should support double quote       ["]
job1 > should support variable expansion [1.27.4]
`.trim());
});

test.concurrent("services <unnamed services should be ignored>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        file: ".gitlab-ci-3.yml",
        noColor: true,
    }, writeStreams);
});
