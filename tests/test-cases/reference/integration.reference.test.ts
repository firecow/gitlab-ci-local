import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("reference <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        job: ["test-job"],
    }, writeStreams);


    const expected = [
        chalk`{blueBright test-job } {greenBright >} Ancient`,
        chalk`{blueBright test-job } {greenBright >} Base`,
        chalk`{blueBright test-job } {greenBright >} Setting something general up`,
        chalk`{blueBright test-job } {greenBright >} array root`,
        chalk`{blueBright test-job } {greenBright >} Yoyo`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("reference --file .gitlab-ci-complex.yml (issue 644)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-complex.yml",
    }, writeStreams);

    const expected = [
        chalk`{blueBright job} {greenBright >} foo`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("reference --file .gitlab-ci-issue-899.yml", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-issue-899.yml",
    }, writeStreams);

    const expected = [
        chalk`{blueBright job} {greenBright >} works`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
