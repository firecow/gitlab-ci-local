import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("--concurrency 1 - should run sequentially", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/concurrency",
        concurrency: 1,
    }, writeStreams);

    const jobOneFinishedIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line.startsWith(chalk`{blueBright one} {magentaBright finished}`);
    });

    const jobTwoStartingIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line.startsWith(chalk`{blueBright two} {magentaBright starting}`);
    });

    // job two should start only after job one is finished
    expect(jobOneFinishedIndex + 1 === jobTwoStartingIndex).toBe(true);
});

test("--concurrency not set", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/concurrency",
    }, writeStreams);

    const jobOneStartingIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line.startsWith(chalk`{blueBright one} {magentaBright starting}`);
    });

    const jobOneFinishedIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line.startsWith(chalk`{blueBright one} {magentaBright finished}`);
    });

    const jobTwoStartingIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line.startsWith(chalk`{blueBright two} {magentaBright starting}`);
    });

    const jobTwoFinishedIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line.startsWith(chalk`{blueBright two} {magentaBright finished}`);
    });

    // job two should start before job one is finished
    expect(jobOneFinishedIndex > jobTwoStartingIndex).toBe(true);
    // job one should start before job two is finished
    expect(jobTwoFinishedIndex > jobOneStartingIndex).toBe(true);
});
