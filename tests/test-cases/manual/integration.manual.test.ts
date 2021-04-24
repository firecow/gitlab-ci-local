import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("manual --manual <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual/",
        manual: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job } {greenBright >} Hello, build job manual!`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("manual --manual <build-job> --manual <build-job", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual/",
        manual: ["build-job", "build-job"],
    }, writeStreams);

    const filter = writeStreams.stdoutLines.filter(l => {
        return l.match(/Hello, build job manual!/) !== null;
    });
    expect(filter.length).toBe(2);
});

test("manual <deploy-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual/",
        job: ["deploy-job"],
    }, writeStreams);

    const foundBuildText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, build job manual!/) !== null;
    });
    expect(foundBuildText).toEqual(undefined);

    const foundTestText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, test job manual!/) !== null;
    });
    expect(foundTestText).toEqual(undefined);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("manual <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual/",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job } {greenBright >} Hello, build job manual!`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("manual", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual/",
    }, writeStreams);

    const foundBuildText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, build job manual!/) !== null;
    });
    expect(foundBuildText).toEqual(undefined);

    const foundTestText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, test job manual!/) !== null;
    });
    expect(foundTestText).toEqual(undefined);
});
