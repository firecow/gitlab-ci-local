import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("reference <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        job: ["test-job"],
        preview: true,
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

test("reference --file .gitlab-ci-complex.yml (issue 644)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-complex.yml",
        preview: true,
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

test("reference --file .gitlab-ci-issue-899.yml", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-issue-899.yml",
        preview: true,
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

test("reference --file .gitlab-ci-issue-954.yml", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference",
        file: ".gitlab-ci-issue-954.yml",
        preview: true,
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
