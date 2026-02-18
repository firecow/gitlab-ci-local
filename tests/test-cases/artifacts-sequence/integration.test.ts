import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-sequence --shell-isolation artifacts copied to next stages", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-sequence",
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-artifacts-sequence-shell-isolation-artifacts-copie",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test.concurrent("artifacts-sequence --shell-isolation parallel matrix artifacts copied to next stages", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-sequence",
        file: ".gitlab-ci-parallel.yml",
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-artifacts-sequence-shell-isolation-parallel-matrix",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});
