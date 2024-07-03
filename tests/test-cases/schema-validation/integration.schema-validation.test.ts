import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("schema validation <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
        // Do nothing
        return undefined as never;
    });

    await handler({
        cwd: "tests/test-cases/schema-validation",
    }, writeStreams);
    expect(writeStreams.stderrLines.join("\n")).toContain("Invalid .gitlab-ci.yml configuration!");
    expect(writeStreams.stderrLines.join("\n")).toContain("property 'script' must not have fewer than 1 characters");
    expect(writeStreams.stderrLines.join("\n")).toContain("'when' property must be one of [on_success, on_failure, always, never, manual, delayed] (found manual2)");
    expect(writeStreams.stderrLines.join("\n")).toContain("'junit' property type must be string");
    expect(writeStreams.stderrLines.join("\n")).toContain("'data' property is not expected to be here");

    expect(mockExit).toHaveBeenCalledWith(1);
});

test("schema validation - default <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        file: ".gitlab-ci-issue-1277.yml",
        cwd: "tests/test-cases/schema-validation",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
my-job:
  script:
    - echo test
  rules:
    - if: $CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH
  cache:
    - key: my-key
      paths:
        - my-file
      policy: pull-push
      when: on_success`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
    expect(writeStreams.stderrLines.join("\n")).toContain("my-job.artifacts is null, ignoring.");
});
