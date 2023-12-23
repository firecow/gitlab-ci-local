import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

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
        chalk`{black.bgGreenBright  FAIL } {blueBright test-job        }`,
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
