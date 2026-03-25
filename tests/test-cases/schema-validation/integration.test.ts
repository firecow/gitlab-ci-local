import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert, {AssertionError} from "assert";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("schema validation <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/schema-validation",
            stateDir: ".gitlab-ci-local-schema-validation-test-job",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("Invalid .gitlab-ci.yml configuration!");
        expect(e.message).toContain("property 'script' must not have fewer than 1 characters");
        expect(e.message).toContain("'when' property must be one of [on_success, on_failure, always, never, manual, delayed] (found manual2)");
        expect(e.message).toContain("'junit' property type must be string");
        expect(e.message).toContain("'data' property is not expected to be here");
    }
});

test.concurrent("schema validation - default <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        file: ".gitlab-ci-issue-1277.yml",
        cwd: "tests/test-cases/schema-validation",
        preview: true,
        stateDir: ".gitlab-ci-local-schema-validation-default-test-job",
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

test.concurrent("schema validation 4 errors", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            file: ".gitlab-ci-4-errors.yml",
            cwd: "tests/test-cases/schema-validation",
            noColor: true,
            stateDir: ".gitlab-ci-local-schema-validation-4-errors",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: any) {
        const expected = `
Invalid .gitlab-ci.yml configuration!
\t• 'variables' property type must be object at error1.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error2.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error3.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error4.variables [#/definitions/jobVariables/type]

`;
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain(expected);
    }
});

test.concurrent("schema validation 5 errors", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            file: ".gitlab-ci-5-errors.yml",
            cwd: "tests/test-cases/schema-validation",
            noColor: true,
            stateDir: ".gitlab-ci-local-schema-validation-5-errors",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: any) {
        const expected = `Invalid .gitlab-ci.yml configuration!
\t• 'variables' property type must be object at error1.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error2.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error3.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error4.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error5.variables [#/definitions/jobVariables/type]

For further troubleshooting, consider either of the following:`;
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain(expected);
    }
});

test.concurrent("schema validation 6 errors", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            file: ".gitlab-ci-6-errors.yml",
            cwd: "tests/test-cases/schema-validation",
            noColor: true,
            stateDir: ".gitlab-ci-local-schema-validation-6-errors",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: any) {
        const expected = `Invalid .gitlab-ci.yml configuration!
\t• 'variables' property type must be object at error1.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error2.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error3.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error4.variables [#/definitions/jobVariables/type]
\t• 'variables' property type must be object at error5.variables [#/definitions/jobVariables/type]
\t... and 1 more

`;
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain(expected);
    }
});
