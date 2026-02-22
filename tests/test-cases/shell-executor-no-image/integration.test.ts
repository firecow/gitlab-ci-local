import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";

test.concurrent("shell-executor-no-image false default-image alpine", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "if-not-present",
        cwd: "tests/test-cases/shell-executor-no-image/",
        shellExecutorNoImage: false,
        defaultImage: "alpine:latest",
        job: ["test-job"],
        noColor: true,
        stateDir: ".gitlab-ci-local-shell-executor-no-image-false-default-image-alpine",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/test-job starting alpine:latest \(test\)/);
});

test.concurrent("shell-executor-no-image false default-image null", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "if-not-present",
        cwd: "tests/test-cases/shell-executor-no-image/",
        shellExecutorNoImage: false,
        defaultImage: null,
        job: ["test-job"],
        noColor: true,
        stateDir: ".gitlab-ci-local-shell-executor-no-image-false-default-image-null",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/test-job starting docker.io\/ruby:3.1 \(test\)/);
});

test.concurrent("shell-executor-no-image true default-image doesnt-matter", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "if-not-present",
        cwd: "tests/test-cases/shell-executor-no-image/",
        shellExecutorNoImage: true,
        defaultImage: "doesnt-matter",
        job: ["test-job"],
        noColor: true,
        stateDir: ".gitlab-ci-local-shell-executor-no-image-true-default-image-doesnt-",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/test-job starting shell \(test\)/);
    expect(writeStreams.stderrLines.join("\n")).toMatch(/WARN\s\s--default-image does not work with --shell-executor-no-image=true/);
});
