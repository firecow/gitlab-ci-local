import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("rules-exists <all-jobs> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/rules-exists",
        needs: true,
    }, writeStreams);

    const output = writeStreams.stdoutLines.join()
    expect(output).toContain("File Executed!")
    expect(output).toContain("Directory Executed!")
    expect(output).not.toContain("File Skipped!")
    expect(output).not.toContain("Directory Skipped!")
});
