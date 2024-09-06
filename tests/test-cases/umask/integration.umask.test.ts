import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

jest.setTimeout(60000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("umask <alpine-guest> --umask", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: true,
        job: ["alpine-guest"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-guest} {greenBright >} 666 one.txt 0 0`,
        chalk`{blueBright alpine-guest} {greenBright >} 777 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <alpine-guest> --no-umask", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: false,
        job: ["alpine-guest"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-guest} {greenBright >} 666 one.txt 101 101`,
        chalk`{blueBright alpine-guest} {greenBright >} 777 script.sh 101 101`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <alpine-root> --umask", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: true,
        job: ["alpine-root"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-root} {greenBright >} 666 one.txt 0 0`,
        chalk`{blueBright alpine-root} {greenBright >} 777 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <alpine-root> --no-umask", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: false,
        job: ["alpine-root"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-root} {greenBright >} 644 one.txt 0 0`,
        chalk`{blueBright alpine-root} {greenBright >} 755 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <kaniko-root> --umask", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: true,
        job: ["kaniko-root"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright kaniko-root} {greenBright >} 666 one.txt 0 0`,
        chalk`{blueBright kaniko-root} {greenBright >} 777 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <kaniko-root> --no-umask", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: false,
        job: ["kaniko-root"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright kaniko-root} {greenBright >} 644 one.txt 0 0`,
        chalk`{blueBright kaniko-root} {greenBright >} 755 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});
