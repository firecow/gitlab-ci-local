import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("hang-forever <test-debian>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/hang-forever",
        job: ["test-debian"],
        stateDir: ".gitlab-ci-local-hang-forever-test-debian",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-debian} {greenBright >} File content`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("hang-forever <test-alpine>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/hang-forever",
        job: ["test-alpine"],
        stateDir: ".gitlab-ci-local-hang-forever-test-alpine",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-alpine} {greenBright >} File content`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("hang-forever <test-shell>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/hang-forever",
        job: ["test-shell"],
        stateDir: ".gitlab-ci-local-hang-forever-test-shell",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-shell} {greenBright >} File content`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
