import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-optional", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-optional",
        needs: true,
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();

    expect(output).toContain("Job executed!");
    expect(output).not.toContain("Job skipped!");
});
