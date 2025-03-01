import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("list-case --list", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-case/",
        list: true,
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage  when      }  {grey allow_failure  needs}`,
        chalk`{blueBright test-job }  Run Tests    {yellow test }  on_success  false      `,
        chalk`{blueBright build-job}               {yellow build}  on_success  true           [{blueBright test-job}]`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
