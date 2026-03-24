import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("component-specific CLI inputs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-multiple",
        input: ["deploy:replicas=10", "build:go_version=\"1.22\"", "environment=staging"],
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - deploy
  - .post
deploy-job:
  stage: deploy
  script:
    - echo "Deploy to staging with 10 replicas"
build-job:
  stage: build
  script:
    - echo "Build with Go 1.22"
    - echo "Cache true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("component-specific CLI overrides file component-specific", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-multiple",
        input: ["deploy:replicas=20"],
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - deploy
  - .post
deploy-job:
  stage: deploy
  script:
    - echo "Deploy to production with 20 replicas"
build-job:
  stage: build
  script:
    - echo "Build with Go 1.21"
    - echo "Cache true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
