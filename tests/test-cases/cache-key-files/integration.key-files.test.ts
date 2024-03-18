import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-key-files <consume-cache> --shell-isolation --needs", async () => {
    await fs.rm("tests/test-cases/cache-key-files/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        job: ["consume-cache"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test("cache-key-files <cache-key-file referencing $CI_PROJECT_DIR>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        job: ["cache-key-file referencing $CI_PROJECT_DIR"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright cache-key-file referencing $CI_PROJECT_DIR} {magentaBright exported cache fakepackage.json 'md-8aaa60c7b3009df8ce6973111af131bbcde5636e'}`,
    ];

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected.join("\n"));
});
