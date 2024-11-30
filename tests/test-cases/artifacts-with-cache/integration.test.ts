import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-with-cache <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-with-cache",
        job: ["test-job"],
        needs: true,
        mountCache: true,
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright pre-job }`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
