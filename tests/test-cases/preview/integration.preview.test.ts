import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("preview", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/preview",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
variables:
  MY_VAR: my value
child-job:
  script:
    - echo "Irrelevant"
  environment:
    name: $MY_VAR
  before_script:
    - echo "Default before script"`;
    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
