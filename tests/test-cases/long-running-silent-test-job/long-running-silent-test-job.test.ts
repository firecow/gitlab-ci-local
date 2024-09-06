import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

jest.setTimeout(13000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("long-running-silent-test-job <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/long-running-silent-test-job",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {grey > still running...}`,
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
