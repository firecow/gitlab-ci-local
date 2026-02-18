import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("never", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never/",
        stateDir: ".gitlab-ci-local-never",
    }, writeStreams);

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});

test.concurrent("never <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never/",
        job: ["test-job"],
        stateDir: ".gitlab-ci-local-never-test-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});

test.concurrent("never <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never/",
        job: ["test-job"],
        needs: true,
        stateDir: ".gitlab-ci-local-never-test-job-needs",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Should never be seen/) !== null;
    });
    expect(found).toEqual(undefined);
});
