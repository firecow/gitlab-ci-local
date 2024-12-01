import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("succesfull-ping", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/network-alias-build",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("unsuccesfull-ping", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/network-alias-build",
        job: ["test-job-failure"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job-failure} {greenBright >} failed`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
