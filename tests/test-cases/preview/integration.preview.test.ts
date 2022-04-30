import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("preview", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/preview",
        preview: true,
    }, writeStreams);

    const expected = [
        chalk`---\nstages:\n  - .pre\n  - build\n  - test\n  - deploy\n  - .post\nchild-job:\n  script:\n    - echo \"Irrelevant\"\n  before_script:\n    - echo \"Default before script\"`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
