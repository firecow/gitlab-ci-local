import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {Utils} from "../../../src/utils.js";

jest.setTimeout(60000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("pull-policy <alpine-guest> --pull-policy=always", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "always",
        cwd: "tests/test-cases/pull-policy/",
        job: ["alpine"],
    }, writeStreams);

    // Pre pull image
    await Utils.spawn(["docker", "pull", "alpine"]);

    // Expect its getting pulld again
    expect(writeStreams.stdoutLines.join("\n")).toMatch(/pulled/);
});
