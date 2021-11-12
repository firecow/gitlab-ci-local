import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-globstar <test-job> --needs --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-globstar",
        job: ["test-job"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Pre something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
