import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("should support 10 level deep", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-10-level-deep.yml",
        cwd: "tests/test-cases/script-multidimension",
        stateDir: ".gitlab-ci-local-should-support-10-level-deep",
    }, writeStreams);

    const expected = `
---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
test-job:
  script:
    - echo 1
    - echo 2
    - echo 3
    - echo 4
    - echo 5
    - echo 6
    - echo 7
    - echo 8
    - echo 9
    - echo 10
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});

test.concurrent("should not support 11 level deep", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            noColor: true,
            file: ".gitlab-ci-11-level-deep.yml",
            cwd: "tests/test-cases/script-multidimension",
            stateDir: ".gitlab-ci-local-should-not-support-11-level-deep",
        }, writeStreams);
    } catch (e: any) {
        expect(e.message).toEqual("This Gitlab CI configuration is invalid: test-job.script config should be string or a nested array of strings up to 10 level deep");
        return;
    }
    throw new Error("Error is expected but not thrown/caught");
});
