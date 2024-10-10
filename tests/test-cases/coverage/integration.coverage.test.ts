import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("coverage <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/coverage",
        job: ["test-job"],
    }, writeStreams);

    const expected = [chalk`{black.bgGreenBright  PASS } {blueBright test-job} 78.46% {gray coverage}`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("coverage <import.meta.jest>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/coverage",
        job: ["import.meta.jest"],
    }, writeStreams);

    const expected = [chalk`{black.bgGreenBright  PASS } {blueBright import.meta.jest} 97.91% {gray coverage}`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
