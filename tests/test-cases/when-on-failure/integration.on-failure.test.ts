import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("when-on-failure", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/when-on-failure",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job  } {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const filter = writeStreams.stdoutLines.filter(l => {
        return l.match(/Deploy something/) !== null;
    });
    expect(filter.length).toBe(0);
});
