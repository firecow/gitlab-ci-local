import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("image <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: "test job",
    }, writeStreams);
    const expected = [chalk`{blueBright test job                } {greenBright >} Test something`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-entrypoint>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: "test-entrypoint",
        privileged: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint         } {greenBright >} Hello from 'firecow/gitlab-ci-local-test-image' image entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} I am epic multiline value`,
        chalk`{blueBright test-entrypoint         } {greenBright >} /builds`,
        chalk`{blueBright test-entrypoint         } {greenBright >} Test Entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} I'm a test file`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-entrypoint-override>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: "test-entrypoint-override",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint-override} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
