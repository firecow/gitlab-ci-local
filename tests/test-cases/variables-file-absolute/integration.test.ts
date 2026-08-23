import path from "node:path";
import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

const cwd = "tests/test-cases/variables-file-absolute";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("a relative variables file is read", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd,
        variablesFile: "my-variables.yml",
        noColor: true,
        stateDir: ".gitlab-ci-local-variables-file-relative",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(["test-job > MYVAR=from-variables-file"]));
});

test.concurrent("an absolute variables file is read", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd,
        variablesFile: path.resolve(cwd, "my-variables.yml"),
        noColor: true,
        stateDir: ".gitlab-ci-local-variables-file-absolute",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(["test-job > MYVAR=from-variables-file"]));
});
