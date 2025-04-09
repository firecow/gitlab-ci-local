import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-local-wildcard-1-dot <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-1.yml",
        includeGlobDot: true,
    }, writeStreams);
    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("job executed!");
    expect(output).toContain("build-images executed!");
    expect(output).toContain("cache-repo executed!");
    expect(output).toContain("docs executed!");
});

test("include-local-wildcard-1 <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-1.yml",
        includeGlobDot: false,
    }, writeStreams);
    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("build-images executed!");
    expect(output).toContain("cache-repo executed!");
    expect(output).toContain("docs executed!");
});

test("include-local-wildcard-2-dot <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-2.yml",
        includeGlobDot: true,
    }, writeStreams);
    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("job executed!");
    expect(output).toContain("build-images executed!");
    expect(output).toContain("cache-repo executed!");
    expect(output).toContain("docs executed!");
});

test("include-local-wildcard-2 <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-2.yml",
        includeGlobDot: false,
    }, writeStreams);
    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("build-images executed!");
    expect(output).toContain("cache-repo executed!");
    expect(output).toContain("docs executed!");
});
