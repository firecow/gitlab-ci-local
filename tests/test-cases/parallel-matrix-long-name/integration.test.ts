import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";

test.concurrent("parallel-matrix-long-name - completes without ENAMETOOLONG", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel-matrix-long-name",
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-parallel-matrix-long-name",
    }, writeStreams);

    // Both matrix entries must complete — the long one would crash with ENAMETOOLONG before the fix
    const passing = writeStreams.stdoutLines.filter(l => l.includes(" PASS "));
    expect(passing.length).toBe(2);
    expect(writeStreams.stdoutLines.some(l => l.includes("build-job: [short]"))).toBe(true);
    expect(writeStreams.stdoutLines.some(l => l.includes("build-job: [my-app-controller,"))).toBe(true);
});
