import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-remote <test-job|build-job>", async () => {
    const mock = new AxiosMockAdapter(axios);
    let body;
    body = await fs.readFile("tests/test-cases/include-remote/remote-mock.yml", "utf8");
    mock.onGet("https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.gitlab-http.yml").reply(200, body);
    body = await fs.readFile("tests/test-cases/include-remote/remote-mock1.yml", "utf8");
    mock.onGet("https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.gitlab-http1.yml").reply(200, body);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-remote",
        job: ["test-job", "build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job } {greenBright >} Test something`,
        chalk`{blueBright build-job} {greenBright >} Build something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
