import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-when <consumer> --needs", async () => {
    await fs.promises.rm("tests/test-cases/artifacts-when/.gitlab-ci-local", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-when",
        job: ["consumer"],
        needs: true,
        noColor: true,
    }, writeStreams);

    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/on_success_success/on_success_success")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/on_success_failure/on_success_failure")).toBe(false);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/on_success_warning/on_success_warning")).toBe(false);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/on_failure_success/on_failure_success")).toBe(false);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/on_failure_failure/on_failure_failure")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/on_failure_warning/on_failure_warning")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/always_success/always_success")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/always_failure/always_failure")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-when/.gitlab-ci-local/artifacts/always_warning/always_warning")).toBe(true);
});
