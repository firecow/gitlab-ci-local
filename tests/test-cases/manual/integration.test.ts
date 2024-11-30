import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("manual --manual <build-job> --manual <pre-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        manual: ["build-job", "pre-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} im a rules variable`,
        chalk`{blueBright pre-job   } {greenBright >} Hello, pre job manual!`,
        chalk`{blueBright build-job } {greenBright >} Hello, build job manual!`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("manual --manual <build-job> --manual <build-job> --manual <pre-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        manual: ["build-job", "build-job", "pre-job"],
    }, writeStreams);

    const filter = writeStreams.stdoutLines.filter(l => {
        return l.match(/Hello, build job manual!/) !== null;
    });
    expect(filter.length).toBe(2);
});

test("manual <deploy-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        job: ["deploy-job"],
    }, writeStreams);

    const foundBuildText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, build job manual!/) !== null;
    });
    expect(foundBuildText).toEqual(undefined);

    const foundTestText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Test something/) !== null;
    });
    expect(foundTestText).toEqual(undefined);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("manual <deploy-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        job: ["deploy-job"],
        needs: true,
    }, writeStreams);

    const foundPreText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, pre job manual!/) !== null;
    });
    expect(foundPreText).toEqual(undefined);

    const foundBuildText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Hello, build job manual!/) !== null;
    });
    expect(foundBuildText).toEqual(undefined);

    const foundTestText = writeStreams.stdoutLines.find((l) => {
        return l.match(/Test something/) !== null;
    });
    expect(foundTestText).toEqual(undefined);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("manual <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Hello, build job manual!`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("manual <test-job> --needs --manual <pre-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        job: ["test-job"],
        needs: true,
        manual: "pre-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job } {greenBright >} Hello, pre job manual!`,
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("manual --manual <pre-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/manual/",
        manual: "pre-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} Hello, pre job manual!`,
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("manual", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/manual/",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright pre-job} is when:manual, its needed by {blueBright test-job}, and not specified in --manual`);
    }
});
