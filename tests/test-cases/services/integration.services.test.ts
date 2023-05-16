import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import fs from "fs-extra";

jest.setTimeout(30000);

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
        chalk`{blueBright pre-job                   } {yellow Could not find exposed tcp ports alpine:latest}`,
        chalk`{blueBright pre-job                   } {redBright >} cat: can't open '/foo.txt': No such file or directory`,
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
        chalk`{black.bgRed  FAIL } {blueBright test-job                  }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const expectedStdErr = [
        chalk`{blueBright test-job                  } {yellow Could not find exposed tcp ports alpine:latest}`,
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
        chalk`{black.bgGreenBright  PASS } {blueBright build-job                 }`,
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
        chalk`{black.bgGreenBright  PASS } {blueBright deploy-job                }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <alias-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["alias-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright alias-job                 }`,
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
    await fs.promises.rm("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-0.log", {force: true});
    await fs.promises.rm("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-1.log", {force: true});
    await fs.promises.rm("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-2.log", {force: true});

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["multie-job"],
    }, writeStreams);

    expect(writeStreams.stderrLines.length).toEqual(4);
    expect(await fs.pathExists("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-0.log")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-1.log")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-2.log")).toEqual(true);
    expect(await fs.readFile("tests/test-cases/services/.gitlab-ci-local/services-output/multie-job/alpine:latest-2.log", "utf-8")).toMatch(/Service 3/);
});

test.concurrent("services <no-tmp>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["no-tmp"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright no-tmp                    }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
