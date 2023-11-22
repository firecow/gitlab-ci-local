import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("cache-paths-undefined-array <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-paths-undefined-array",
        job: ["test-job"],
        maxJobNamePadding: 0,
    }, writeStreams);


    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});


test("cache-paths-empty-object <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-paths-undefined-array",
        job: ["test-empty-cache-object"],
        maxJobNamePadding: 0,
    }, writeStreams);


    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-empty-cache-object}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});