import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-remote <test-job>", async () => {
    const mock = new AxiosMockAdapter(axios);
    const body = await fs.readFile("tests/test-cases/include-remote/remote-mock.yml", "utf8");
    mock.onGet("https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.gitlab-http.yml").reply(200, body);

    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/include-remote",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
