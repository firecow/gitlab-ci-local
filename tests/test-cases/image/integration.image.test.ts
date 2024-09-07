import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {cleanupJobResources, Job} from "../../../src/job.js";

import.meta.jest.setTimeout(30000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("image <test job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test job"],
    }, writeStreams);
    const expected = [chalk`{blueBright test job} {greenBright >} Test something`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("image <test-entrypoint>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test-entrypoint"],
        privileged: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint} {greenBright >} Hello from 'firecow/gitlab-ci-local-test-image' image entrypoint`,
        chalk`{blueBright test-entrypoint} {greenBright >} I am epic multiline value`,
        chalk`{blueBright test-entrypoint} {greenBright >} /gcl-builds`,
        chalk`{blueBright test-entrypoint} {greenBright >} Test Entrypoint`,
        chalk`{blueBright test-entrypoint} {greenBright >} I'm a test file`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("image <test-entrypoint-override>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test-entrypoint-override"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint-override} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("image <test-from-scratch>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test-from-scratch"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-from-scratch} {greenBright >} 0:0 .gitlab-ci.yml`,
        chalk`{blueBright test-from-scratch} {greenBright >} 666 .gitlab-ci.yml`,
        chalk`{blueBright test-from-scratch} {greenBright >} 777 folder/`,
        chalk`{blueBright test-from-scratch} {greenBright >} 777 executable.sh`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

// Regression test for #452. We create a test-file.txt at root of repo which is
// ignored. The bug would cause this to also ignore test-file.txt in ./folder,
// which it should not. Expected output will differ if ./folder/test-file.txt
// is also ignored.
test.concurrent("image <test-ignore-regression>", async () => {
    const writeStreams = new WriteStreamsMock();

    try {
        await fs.writeFile("tests/test-cases/image/test-file.txt", "I'm ignored\n");
        await handler({
            cwd: "tests/test-cases/image",
            job: ["test-entrypoint"],
        }, writeStreams);
    } finally {
        await fs.rm("tests/test-cases/image/test-file.txt", {force: true});
    }

    const expected = [
        chalk`{blueBright test-entrypoint} {greenBright >} I'm a test file`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("image <issue-206>", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/image",
        job: ["issue-206"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright issue-206} {redBright >} Error: open /gcl-builds/hugo: no such file or directory`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("image <image-user>", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/image",
        job: ["image-user"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright image-user} {greenBright >} 65534`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("pull invalid image", async () => {
    const jobs: Job[] = [];
    const writeStreams = new WriteStreamsMock();
    const handlerPromise = handler({
        cwd: "tests/test-cases/image",
        file: ".gitlab-ci-invalid-image.yml",
    }, writeStreams, jobs);

    await expect(handlerPromise).rejects.toThrow(/Command failed with exit code/);

    await cleanupJobResources(jobs);
});
