import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("extends <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/extends",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something (before_script)`,
        chalk`{blueBright test-job} {greenBright >} Test something`,
        chalk`{blueBright test-job} {greenBright >} Test something (after_script)`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

});
