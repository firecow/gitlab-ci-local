import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-local <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-slash",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("Nested test executed!");
});

