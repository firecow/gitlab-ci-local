import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-artifacts <test-job> --needs --shell-isolation", async () => {
    // Test if one.txt is actually remove from consumer (test-job) before script execution
    await fs.outputFile("tests/test-cases/needs-artifacts/.gitlab-ci-local/builds/test-job/one.txt", "");

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-artifacts",
        job: ["test-job"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});
