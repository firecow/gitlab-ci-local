import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

// Issue: component-specific CLI input must override global CLI input on key conflict
test("component-specific CLI wins over global CLI on same key", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-edge-cases",
        input: ["replicas=1", "deploy:replicas=10"],
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
    - echo "Replicas 10"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

// Global CLI applies but file component-specific takes precedence
test("file component-specific overrides global CLI", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/component-inputs-edge-cases",
        input: ["replicas=7"],
        preview: true,
    }, writeStreams);

    // File has deploy.replicas=3 (component-specific), which overrides global CLI replicas=7
    const expected = `---
stages:
  - .pre
  - deploy
  - .post
deploy-production:
  stage: deploy
  script:
    - echo "Deploying to production"
    - echo "Replicas 3"`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
