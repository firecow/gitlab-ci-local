import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

jest.setTimeout(60000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("umask <alpine-guest> --umask --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: true,
        needs: true,
        job: ["alpine-guest"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-guest} {greenBright >} 666 one.txt 0 0`,
        chalk`{blueBright alpine-guest} {greenBright >} 777 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <alpine-guest> --no-umask --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: false,
        needs: true,
        job: ["alpine-guest"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-guest} {greenBright >} 666 one.txt 405 100`,
        chalk`{blueBright alpine-guest} {greenBright >} 777 script.sh 405 100`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <alpine-root> --umask --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        needs: true,
        umask: true,
        job: ["alpine-root"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-root} {greenBright >} 666 one.txt 0 0`,
        chalk`{blueBright alpine-root} {greenBright >} 777 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});

test.concurrent("umask <alpine-root> --no-umask --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        needs: true,
        umask: false,
        job: ["alpine-root"],
    }, writeStreams);

    const expectedStdOut = [
        chalk`{blueBright alpine-root} {greenBright >} 644 one.txt 0 0`,
        chalk`{blueBright alpine-root} {greenBright >} 755 script.sh 0 0`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdOut));
});
