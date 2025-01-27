import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";

test("force-shell-executor false default-image alpine", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "if-not-present",
        cwd: "tests/test-cases/force-shell-executor/",
        forceShellExecutor: false,
        defaultImage: "alpine:latest",
        job: ["test-job"],
        noColor: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/test-job starting alpine:latest \(test\)/);
});

test("force-shell-executor false default-image null but job image alpine", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "if-not-present",
        cwd: "tests/test-cases/force-shell-executor/",
        forceShellExecutor: false,
        defaultImage: null,
        job: ["test-job"],
        noColor: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/test-job starting alpine:latest \(test\)/);
});

test("force-shell-executor true default-image doesnt-matter", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        pullPolicy: "if-not-present",
        cwd: "tests/test-cases/force-shell-executor/",
        forceShellExecutor: true,
        defaultImage: "doesnt-matter",
        job: ["test-job"],
        noColor: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/test-job starting shell \(test\)/);
    expect(writeStreams.stderrLines.join("\n")).toMatch(/WARN\s\s--default-image does not work with --force-shell-executor=true/);
});
