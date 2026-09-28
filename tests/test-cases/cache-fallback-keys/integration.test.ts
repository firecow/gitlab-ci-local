import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-fallback-keys --preview", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-fallback-keys",
        preview: true,
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
  script:
    - echo "Heya"
  cache:
    - key: $CI_COMMIT_REF_SLUG
      fallback_keys:
        - main
      paths:
        - a
      policy: pull-push
      when: on_success`;
    expect(writeStreams.stdoutLines[0]).toEqual(expected.trim());
});
