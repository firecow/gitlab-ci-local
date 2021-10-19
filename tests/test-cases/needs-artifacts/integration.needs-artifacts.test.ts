import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";

test("needs-artifacts <test-job> --needs --shell-isolation", async () => {
    // Test if one.txt is actually remove from consumer (test-job) before script execution
    await fs.outputFile("tests/test-cases/needs-artifacts/.gitlab-ci-local/builds/test-job/one.txt", "");

    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs-artifacts",
        job: ["test-job"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);
    expect(writeStreams.stderrLines).toEqual([]);
});
