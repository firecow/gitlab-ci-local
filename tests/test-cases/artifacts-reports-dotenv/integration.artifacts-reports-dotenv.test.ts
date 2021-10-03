import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("artifacts-reports-dotenv <deploy-image> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["deploy-image"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});

test("artifacts-reports-dotenv <deploy-shell-iso> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["deploy-shell-iso"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});

test("artifacts-reports-dotenv <deploy-shell-noiso> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["deploy-shell-noiso"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
