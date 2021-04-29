import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("list-case --list", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/list-case/",
        list: true,
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage  when      }  {grey allow_failure  needs}`,
        chalk`{blueBright test-job }  Run Tests  {yellow test }  on_success  false      `,
        chalk`{blueBright build-job}             {yellow build}  on_success  true           [{blueBright test-job}]`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
