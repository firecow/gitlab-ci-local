import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-double-run <test-job> --shell-isolation", async () => {
    await fs.rm("tests/test-cases/cache-double-run/.gitlab-ci-local", {recursive: true, force: true});

    let writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-double-run",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);
    const expectedStderr = [chalk`{blueBright test-job} {redBright >} Cache not warm`];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expectedStderr));

    writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-double-run",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);
    const expectedStdout = [chalk`{blueBright test-job} {greenBright >} Cache warm`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdout));
});
