import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-reports-dotenv <deploy-image> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["deploy-image"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test("artifacts-reports-dotenv <deploy-shell-iso> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["deploy-shell-iso"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test("artifacts-reports-dotenv <deploy-shell-noiso> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["deploy-shell-noiso"],
        needs: true,
        shellIsolation: false,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test("artifacts-reports-dotenv <test-multi-dotenv> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["test-multi-dotenv"],
        needs: true,
        file: ".gitlab-ci-issue-1160.yml",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test("artifacts-reports-dotenv <test-multi-dotenv-with-missing-file> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-reports-dotenv",
        job: ["test-multi-dotenv-with-missing-file"],
        needs: true,
        file: ".gitlab-ci-issue-1160.yml",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).toContain("artifact reports dotenv 'multi4.env' could not be found");
    expect(writeStreams.stderrLines.join("\n")).toContain("TEST_MULTI_2: unbound variable");
});
