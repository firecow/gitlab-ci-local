import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";

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
