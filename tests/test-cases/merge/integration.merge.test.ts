import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("merge", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/merge",
        merge: true,
    }, writeStreams);

    const expected = [
        chalk`---\nstages:\n  - .pre\n  - build\n  - test\n  - deploy\n  - .post\nchild-job:\n  script:\n    - echo \"Irrelevant\"\n  environment:\n    name: $MY_VAR\n  before_script:\n    - echo \"Default before script\"`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
