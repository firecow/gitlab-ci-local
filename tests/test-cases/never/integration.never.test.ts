import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("never", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never/",
    }, writeStreams);

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});

test("never <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never/",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job } {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});

test("never <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never/",
        job: ["test-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job } {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});
