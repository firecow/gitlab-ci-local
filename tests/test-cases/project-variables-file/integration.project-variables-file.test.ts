import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy([...WhenStatics.all]);
});

test.concurrent("project-variables-file <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/project-variables-file",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Y`,
        chalk`{blueBright test-job} {greenBright >} Recursive CI/CD`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
