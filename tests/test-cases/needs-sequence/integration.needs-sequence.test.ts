import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("needs-sequence <deploy-job> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs-sequence",
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

test("needs-sequence", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs-sequence",
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} .pre something`,
        chalk`{blueBright build-job } {greenBright >} Build something`,
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
