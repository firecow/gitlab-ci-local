import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("reference <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        job: ["test-job"],
        preview: true,
        stateDir: ".gitlab-ci-local-reference-test-job",
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
test-job:
  variables:
    MYVAR: Yoyo
  script:
    - echo "Ancient"
    - echo "Base"
    - echo "Setting something general up"
    - echo "array root"
    - echo \${MYVAR}
issue-909:
  script:
    - echo TEST`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test.concurrent("reference --file .gitlab-ci-complex.yml (issue 644)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-complex.yml",
        preview: true,
        stateDir: ".gitlab-ci-local-reference-file-gitlab-ci-complex-yml-issue-644",
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
job:
  variables:
    FOO: foo
  script:
    - echo $FOO`;
    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test.concurrent("reference --file .gitlab-ci-issue-899.yml", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-issue-899.yml",
        preview: true,
        stateDir: ".gitlab-ci-local-reference-file-gitlab-ci-issue-899-yml",
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
job:
  image:
    name: docker.io/library/bash
  script:
    - echo "works"`;
    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test.concurrent("reference --file .gitlab-ci-issue-954.yml", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-issue-954.yml",
        preview: true,
        stateDir: ".gitlab-ci-local-reference-file-gitlab-ci-issue-954-yml",
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
normal_job:
  image:
    name: alpine
  before_script:
    - echo Hello from \${CI_JOB_NAME}
  script:
    - echo Hello from \${CI_JOB_NAME}
  after_script:
    - echo Hello from \${CI_JOB_NAME}`;
    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});


test.concurrent("should support 10 level deep", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-10-level-deep.yml",
        cwd: "tests/test-cases/reference",
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
test:
  image:
    name: alpine
  script:
    - echo test
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});

test.concurrent("should not support 11 level deep", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            noColor: true,
            file: ".gitlab-ci-11-level-deep.yml",
            cwd: "tests/test-cases/reference",
            stateDir: ".gitlab-ci-local-should-not-support-11-level-deep",
        }, writeStreams);
    } catch (e: any) {
        expect(e.message).toEqual("This Gitlab CI configuration is invalid: test.script config should be string or a nested array of strings up to 10 level deep");
        return;
    }
    throw new Error("Error is expected but not thrown/caught");
});

it("should let a job's own value replace an inherited reference", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-1.yml",
        cwd: "tests/test-cases/reference",
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
  variables:
    NICENESS: byrdalos
  script:
    - echo \${NICENESS}
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});

it("should have a lower precedence than a local scope", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-2.yml",
        cwd: "tests/test-cases/reference",
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
  variables:
    NICENESS: byrdalos
  script:
    - echo \${NICENESS}
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});

it("should have a lower precedence than a local scope", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-3.yml",
        cwd: "tests/test-cases/reference",
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
  variables:
    MY_VAR: MY_VAL
  rules:
    - if: $MY_VAR == "MY_VAL"
      when: always
  script:
    - echo "hello world job"
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});

it("should replace an inherited value with the job's own reference", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-issue-1951.yml",
        cwd: "tests/test-cases/reference",
    }, writeStreams);

    const expected = `
---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
job:
  image:
    name: alpine
  cache:
    - key: k
      paths:
        - a
        - b
        - jib
      policy: pull-push
      when: on_success
  script:
    - echo "Heya"
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});

it("should carry a reference through a job that extends the one holding it", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        preview: true,
        file: ".gitlab-ci-inherited-reference.yml",
        cwd: "tests/test-cases/reference",
    }, writeStreams);

    const expected = `
---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
holder:
  cache:
    - key: src
      paths: &ref_0
        - a
        - b
        - jib
      policy: pull-push
      when: on_success
  script:
    - echo "Heya"
inherits:
  cache:
    - key: src
      paths: *ref_0
      policy: pull-push
      when: on_success
  script:
    - echo "Heya"
overrides:
  cache:
    - key: own
      paths:
        - own
      policy: pull-push
      when: on_success
  script:
    - echo "Heya"
nested:
  cache:
    - key:
        files:
          - k.lock
      paths:
        - a
        - b
      policy: pull-push
      when: on_success
  script:
    - echo "Heya"
`;

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.trim());
});
