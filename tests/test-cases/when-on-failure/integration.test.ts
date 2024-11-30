import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("when-on-failure", async () => {
    const writeStreams = new WriteStreamsMock();
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
