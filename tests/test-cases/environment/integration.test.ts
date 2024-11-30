import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("environment <deploy-dev-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/environment",
        job: ["deploy-dev-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-dev-job} environment: \{ name: {bold dev-domain} \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

});

test("environment <deploy-stage-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/environment",
        job: ["deploy-stage-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-stage-job} {greenBright >} stage-domain`,
        chalk`{blueBright deploy-stage-job} {greenBright >} Stage Domain`,
        chalk`{blueBright deploy-stage-job} {greenBright >} http://stage.domain.com`,
        chalk`{blueBright deploy-stage-job} {greenBright >} stop`,
        chalk`{blueBright deploy-stage-job} {greenBright >} production`,
        chalk`{blueBright deploy-stage-job} environment: \{ name: {bold Stage Domain}, url: {bold http://stage.domain.com} \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

});
