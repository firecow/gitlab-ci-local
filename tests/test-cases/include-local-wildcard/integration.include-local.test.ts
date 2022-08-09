import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-local-wildcard <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci.yml",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("build-images executed!");
    expect(output).toContain("cache-repo executed!");
    expect(output).toContain("docs executed!");
});
