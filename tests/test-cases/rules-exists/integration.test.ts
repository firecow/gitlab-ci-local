import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("rules-exists", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/rules-exists",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("File Executed!");
    expect(output).toContain("Directory Executed!");
    expect(output).toContain("Directory Recursive Executed!");
    expect(output).not.toContain("File Skipped!");
    expect(output).not.toContain("Directory Skipped!");
    expect(output).not.toContain("Directory Recursive Skipped!");
});
