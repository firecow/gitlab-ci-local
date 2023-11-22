import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-pull-key-only <test-job>", async () => {
    await fs.rm("tests/test-cases/cache-pull-key-only/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-pull-key-only",
        maxJobNamePadding: 0,
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright create-cache}`,
        chalk`{black.bgGreenBright  PASS } {blueBright use-cache}`,
        chalk`{black.bgGreenBright  PASS } {blueBright use-cache-2}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
