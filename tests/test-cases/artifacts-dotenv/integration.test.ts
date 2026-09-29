import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-dotenv <use-image-ref> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-dotenv",
        job: ["use-image-ref"],
        needs: true,
        noColor: true,
        stateDir: ".gitlab-ci-local-artifacts-dotenv-use-image-ref-needs",
    }, writeStreams);

    // The job only runs at all if BUILD_IMAGE_REF expanded into `image`
    expect(writeStreams.stdoutLines.join("\n")).toMatch(/use-image-ref\s+> NAME="Alpine Linux"/);
    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test.concurrent("artifacts-dotenv <use-service-ref> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-dotenv",
        job: ["use-service-ref"],
        needs: true,
        noColor: true,
        stateDir: ".gitlab-ci-local-artifacts-dotenv-use-service-ref-needs",
    }, writeStreams);

    // SERVICE_IMAGE_ALIAS expanded into the service alias, so it resolves in DNS
    expect(writeStreams.stdoutLines.join("\n")).toMatch(/use-service-ref\s+> redis has address/);
    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test.concurrent("artifacts-dotenv <use-non-success-ref> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-dotenv",
        job: ["use-non-success-ref"],
        needs: true,
        noColor: true,
        stateDir: ".gitlab-ci-local-artifacts-dotenv-use-non-success-ref-needs",
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toMatch(/use-non-success-ref\s+> FAILURE_REF is \[failure-value\]/);
    expect(stdout).toMatch(/use-non-success-ref\s+> WARNING_REF is \[warning-value\]/);
    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/use-non-success-ref.*FAIL/);
});
