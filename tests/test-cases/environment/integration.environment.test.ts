import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("environment <deploy-dev-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/environment",
        job: ["deploy-dev-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-dev-job} environment: \{ name: {bold dev-domain} \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});

test("environment <deploy-stage-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/environment",
        job: ["deploy-stage-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-stage-job} environment: \{ name: {bold stage-domain}, url: {bold http://stage.domain.com} \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
