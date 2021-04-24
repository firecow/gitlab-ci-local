import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("needs <build-job> --needs", async () => {
    const mockWriteStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs",
        job: ["build-job"],
        needs: true,
    }, mockWriteStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} .pre something`,
        chalk`{blueBright build-job } {greenBright >} Build something`,
    ];
    expect(mockWriteStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("needs <deploy-job> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs",
        job: ["deploy-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} .pre something`,
        chalk`{blueBright build-job } {greenBright >} Build something`,
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/.pre something/) !== null;
    });
    expect(found.length).toEqual(2);
});

test("needs", async () => {
    const mockWriteStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs",
    }, mockWriteStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} .pre something`,
        chalk`{blueBright build-job } {greenBright >} Build something`,
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(mockWriteStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
