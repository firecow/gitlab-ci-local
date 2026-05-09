import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("list-case --list", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-case/",
        list: true,
        stateDir: ".gitlab-ci-local-list-case",
    }, writeStreams);

    const expected = [
        chalk`{grey ${"name".padEnd(9)}  ${"description".padEnd(11)}}  {grey ${"stage".padEnd(5)}  ${"when".padEnd(10)}}  {grey allow_failure  ${"environment".padEnd(11)}  needs}`,
        chalk`{blueBright ${"test-job".padEnd(9)}}  ${"Run Tests".padEnd(11)}  {yellow ${"test".padEnd(5)}}  ${"on_success".padEnd(10)}  ${"false".padEnd(13)}  ${"".padEnd(11)}`,
        chalk`{blueBright ${"build-job".padEnd(9)}}  ${"".padEnd(11)}  {yellow ${"build".padEnd(5)}}  ${"on_success".padEnd(10)}  ${"true".padEnd(13)}  ${"".padEnd(11)}  [{blueBright test-job}]`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
