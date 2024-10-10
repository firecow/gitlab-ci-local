import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("trigger", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/trigger",
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright pipe-gen-job   }`,
        chalk`{black.bgGreenBright  PASS } {blueBright include-trigger}`,
        chalk`{black.bgGreenBright  PASS } {blueBright remote-trigger }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
