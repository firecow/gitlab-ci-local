import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-optional-complex", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-optional-complex",
        needs: true,
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("Validated!");
    expect(output).toContain("Job executed!");
    expect(output).not.toContain("Job skipped!");
});
