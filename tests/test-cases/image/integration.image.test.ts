import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("image <test job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test job"],
    }, writeStreams);
    const expected = [chalk`{blueBright test job                } {greenBright >} Test something`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-entrypoint>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test-entrypoint"],
        privileged: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint         } {greenBright >} Hello from 'firecow/gitlab-ci-local-test-image' image entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} I am epic multiline value`,
        chalk`{blueBright test-entrypoint         } {greenBright >} /builds/test-entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} Test Entrypoint`,
        chalk`{blueBright test-entrypoint         } {greenBright >} I'm a test file`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-entrypoint-override>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test-entrypoint-override"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-entrypoint-override} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("image <test-from-scratch>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/image",
        job: ["test-from-scratch"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-from-scratch       } {greenBright >} 0:0 .gitlab-ci.yml`,
        chalk`{blueBright test-from-scratch       } {greenBright >} 666 .gitlab-ci.yml`,
        chalk`{blueBright test-from-scratch       } {greenBright >} 777 folder/`,
        chalk`{blueBright test-from-scratch       } {greenBright >} 777 executable.sh`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
