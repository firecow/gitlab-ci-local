import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("basic-inputs defaults no inputs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/basic-inputs/input-templates/default-no-inputs",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
scan-website:
  script:
    - echo string
    - echo 1
    - echo true
    - alice
    - bob`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
