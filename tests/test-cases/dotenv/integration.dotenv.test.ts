import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("dotenv <test-job>", async () => {
    await fs.rm("tests/test-cases/dotenv/.gitlab-ci-local", {force: true, recursive: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/dotenv",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} world`,
        chalk`{blueBright test-job} {greenBright >} doh`,
    ];
    // expect(await fs.pathExists("tests/test-cases/dotenv/.gitlab-ci-local")).toEqual(false);
    expect(await fs.pathExists("tests/test-cases/dotenv/symfony/.gitlab-ci-local")).toEqual(true);
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
