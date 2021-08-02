import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import fs from "fs-extra";

test("plain", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/plain",
    }, writeStreams);

    expect(writeStreams.stdoutLines.length).toEqual(14);
    expect(writeStreams.stderrLines.length).toEqual(1);

    expect(await fs.pathExists("tests/test-cases/plain/.gitlab-ci-local/builds/test-job")).toBe(false);
    expect(await fs.pathExists("tests/test-cases/plain/.gitlab-ci-local/builds/build-job")).toBe(false);
});

test("plain <test-job> <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/plain",
        job: ["test-job", "test-job"],
    }, writeStreams);

    const found = writeStreams.stderrLines.filter((l) => {
        return l.match(/Hello, error!/) !== null;
    });
    expect(found.length).toEqual(1);
});

test("plain <notfound>", async () => {
    const writeStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/plain",
            job: ["notfound"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright notfound} could not be found`);
    }
});
