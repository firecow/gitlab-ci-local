import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-shell-fail <produce-> --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-shell-fail",
        job: ["produce"],
        shellIsolation: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright produce} {yellow !! no artifacts was copied !!}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
