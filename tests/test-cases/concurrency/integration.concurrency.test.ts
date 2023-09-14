import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
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

    const jobOneIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line === chalk`{blueBright one} {green $ sleep 1}`;
    });

    const jobTwoIndex = writeStreams.stdoutLines.findIndex((line) => {
        return line === chalk`{blueBright two} {green $ sleep 1}`;
    });

    expect(jobOneIndex).toEqual(1);
    expect(jobTwoIndex).toEqual(4);
});

test("--concurrency not set", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/concurrency",
    }, writeStreams);

    expect(writeStreams.stderrLines.length).toEqual(2);
});
