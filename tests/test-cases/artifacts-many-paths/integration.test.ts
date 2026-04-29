import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

// Validates that --files-from works correctly when the number of artifact files
// would exceed ARG_MAX if their paths were passed directly as rsync arguments
// (9000 files × ~257 bytes ≈ 2.3 MB > ARG_MAX ~2 MB).
test.concurrent("artifacts-many-paths --shell-isolation 9000 artifacts via --files-from", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-many-paths",
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-many-paths",
    }, writeStreams);

    // Ensures artifacts were actually exported (not silently swallowed by || true).
    expect(writeStreams.stdoutLines.join("\n")).toMatch(/produce-artifacts.*exported artifacts/);
    // Ensures consume-artifacts found all 9000 expected files.
    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
}, 120_000);
