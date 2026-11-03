import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk-template";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("needs-empty-entry <dev-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-empty-entry",
        job: ["dev-job"],
        needs: true,
        stateDir: ".gitlab-ci-local-needs-empty-entry",
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} build`,
        chalk`{blueBright dev-job  } {greenBright >} dev`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
