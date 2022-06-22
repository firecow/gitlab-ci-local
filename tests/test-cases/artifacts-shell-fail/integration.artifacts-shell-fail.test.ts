import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-shell-fail <build|test|deploy> --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-shell-fail",
        job: ["build", "test", "deploy"],
        shellIsolation: true,
    }, writeStreams);

    let expected;
    expected = [
        chalk`{blueBright build } {yellow !! no artifacts was copied !!}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    expected = [
        chalk`{blueBright test  } {yellow artifacts from {blueBright build} was empty}`,
        chalk`{blueBright deploy} {yellow artifacts from {blueBright build} was empty}`,
        chalk`{blueBright deploy} {yellow artifacts from {blueBright test} was empty}`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expected));
});
