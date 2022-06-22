import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("trigger", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/trigger",
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright pipe-gen-job}`,
        chalk`{black.bgGreenBright  PASS } {blueBright trigger_job }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
