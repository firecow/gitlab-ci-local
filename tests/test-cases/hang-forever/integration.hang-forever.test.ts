import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("hang-forever <test-debian>", async() => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/hang-forever",
        job: "test-debian"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-debian} {greenBright >} File content`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("hang-forever <test-alpine>", async() => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/hang-forever",
        job: "test-alpine"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-alpine} {greenBright >} File content`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});

test("hang-forever <test-shell>", async() => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/hang-forever",
        job: "test-shell"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-shell } {greenBright >} File content`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});
