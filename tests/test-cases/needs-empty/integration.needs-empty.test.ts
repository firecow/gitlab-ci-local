import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-empty <deploy-job> --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-empty",
        job: ["deploy-job"],
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});
