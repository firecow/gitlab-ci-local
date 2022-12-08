import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-rules <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-rules",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
        variable: ["CI_COMMIT_TAG=1.0.0"]
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} This should appear`,
        chalk`{blueBright test-job } {greenBright >} This should appear, because of CI_COMMIT_TAG variable`,
    ];

    const notExpected = [
        chalk`{blueBright build-job} {greenBright >} This should not appear`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining(notExpected));
});
