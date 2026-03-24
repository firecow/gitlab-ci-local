import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("component-inputs-cli from file", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-cli",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - deploy
  - .post
deploy-production:
  stage: deploy
  script:
    - echo "Deploying to production"
    - echo "Replicas 5"
    - echo "Cache enabled true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("component-inputs-cli from CLI", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-cli",
        input: ["environment=staging", "replicas=3"],
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - deploy
  - .post
deploy-staging:
  stage: deploy
  script:
    - echo "Deploying to staging"
    - echo "Replicas 3"
    - echo "Cache enabled true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("component-inputs-cli CLI overrides file", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-cli",
        input: ["environment=testing"],
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - deploy
  - .post
deploy-testing:
  stage: deploy
  script:
    - echo "Deploying to testing"
    - echo "Replicas 5"
    - echo "Cache enabled true"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
