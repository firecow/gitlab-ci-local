import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("component-inputs-multiple from file", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-multiple",
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
    - echo "Deploy to production with 5 replicas"
build-job:
  stage: build
  script:
    - echo "Build with Go 1.21"
    - echo "Cache true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("component-inputs-multiple global CLI does not override file component-specific", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-multiple",
        input: ["replicas=10", "go_version=\"1.22\""],
        preview: true,
    }, writeStreams);

    // Global CLI inputs do NOT override file component-specific values.
    // File has deploy.replicas=5 and build.go_version="1.21" (component-specific),
    // so those take precedence over global CLI replicas=10 and go_version="1.22".
    // Use component-specific CLI syntax (deploy:replicas=10) to override.
    const expected = `---
stages:
  - .pre
  - build
  - deploy
  - .post
deploy-job:
  stage: deploy
  script:
    - echo "Deploy to production with 5 replicas"
build-job:
  stage: build
  script:
    - echo "Build with Go 1.21"
    - echo "Cache true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("component-inputs-multiple CLI overrides global", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-multiple",
        input: ["environment=staging"],
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
    - echo "Deploy to staging with 5 replicas"
build-job:
  stage: build
  script:
    - echo "Build with Go 1.21"
    - echo "Cache true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
