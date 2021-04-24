import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("never", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/never/",
    }, writeStreams);

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});

test("never <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
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
