import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("comment-directive-anchor --list", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/comment-directive-anchor/",
        list: true,
        noColor: true,
        stateDir: ".gitlab-ci-local-comment-directive-anchor",
    }, writeStreams);

    const descriptionOf = (jobName: string) => {
        const line = writeStreams.stdoutLines.find(l => l.startsWith(`${jobName}  `));
        expect(line, `no output line for job ${jobName}`).toBeDefined();
        return line!.slice(jobName.length).trimStart().replace(/\s{2,}.*$/, "");
    };

    expect(descriptionOf("firstjob")).toBe("Runs first");
    expect(descriptionOf("sourcemaps")).toBe("Upload source maps. Opt in per brand:");
    expect(descriptionOf("deploy to prod")).toBe("Deploys everything");
    expect(descriptionOf("build/image")).toBe("Builds the image");
    expect(descriptionOf("plainjob")).toBe("Runs the tests");
});
