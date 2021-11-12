import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("reference <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/reference",
        job: ["test-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines[3]).toEqual(chalk`{blueBright test-job} {greenBright >} Ancient`);
    expect(writeStreams.stdoutLines[5]).toEqual(chalk`{blueBright test-job} {greenBright >} Base`);
    expect(writeStreams.stdoutLines[7]).toEqual(chalk`{blueBright test-job} {greenBright >} Setting something general up`);
    expect(writeStreams.stdoutLines[9]).toEqual(chalk`{blueBright test-job} {greenBright >} Yoyo`);
    expect(writeStreams.stderrLines).toEqual([]);
});
