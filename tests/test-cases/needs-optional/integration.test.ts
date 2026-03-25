import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("needs-optional", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-optional",
        needs: true,
        stateDir: ".gitlab-ci-local-needs-optional",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();

    expect(output).toContain("Job executed!");
    expect(output).not.toContain("Job skipped!");
});
