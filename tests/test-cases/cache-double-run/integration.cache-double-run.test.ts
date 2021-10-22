import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import chalk from "chalk";

test.concurrent("cache-double-run <test-job> --shell-isolation", async () => {
    await fs.rm("tests/test-cases/cache-double-run/.gitlab-ci-local", {recursive: true, force:true});

    let writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache-double-run",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);
    const expectedStderr = [chalk`{blueBright test-job} {redBright >} Cache not warm`];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expectedStderr));

    writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache-double-run",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);
    const expectedStdout = [chalk`{blueBright test-job} {greenBright >} Cache warm`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdout));
    expect(writeStreams.stderrLines).toEqual([]);
});
