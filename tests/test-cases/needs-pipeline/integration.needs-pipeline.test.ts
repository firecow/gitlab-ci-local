import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-pipeline", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-pipeline",
        needs: true,
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();

    const expected = [
        chalk`{yellow needs-pipeline-job.needs[1].job:other-pipeline-job ignored, pipeline key not supported}`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expected));
    expect(output).toContain("Job executed!");
});
