import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-local-wildcard <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci.yml",
    }, writeStreams);
    const output = writeStreams.stdoutLines.join();
    expect(output).toContain("build-images executed!");
    expect(output).toContain("cache-repo executed!");
    expect(output).toContain("docs executed!");
});

test("expect `configs/**.yml` to match all `.yml` files in `configs` and any subfolder in it.", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-1.yml",
        preview: true,
        noColor: true,
    }, writeStreams);
    expect(writeStreams.stdoutLines.join()).toEqual(`
---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
configs/.gitlab-ci.yml:
  script:
    - echo hello world
configs/subfolder/.gitlab-ci.yml:
  script:
    - echo hello world
configs/subfolder/subfolder/.gitlab-ci.yml:
  script:
    - echo hello world
`.trim());
});

test("expect `configs/**/*.yml` to match files only in subfolders of `configs`", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-2.yml",
        preview: true,
        noColor: true,
    }, writeStreams);
    expect(writeStreams.stdoutLines.join()).toEqual(`
---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
configs/subfolder/.gitlab-ci.yml:
  script:
    - echo hello world
configs/subfolder/subfolder/.gitlab-ci.yml:
  script:
    - echo hello world
`.trim());
});

test("expect `configs/*.yml` to match only `.yml` files in `configs`.", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local-wildcard",
        file: ".gitlab-ci-3.yml",
        preview: true,
        noColor: true,
    }, writeStreams);
    expect(writeStreams.stdoutLines.join()).toEqual(`
---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
configs/.gitlab-ci.yml:
  script:
    - echo hello world
`.trim());
});
