import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

jest.setTimeout(13000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("long-running-silent-test-job <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/long-running-silent-test-job",
        job: ["test-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines[3]).toEqual(chalk`{blueBright test-job} {grey > still running...}`);
    expect(writeStreams.stdoutLines[5]).toEqual(chalk`{blueBright test-job} {greenBright >} Test something`);
    expect(writeStreams.stderrLines).toEqual([]);
});
