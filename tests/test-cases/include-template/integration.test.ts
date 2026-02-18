import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-template <test-job>", async () => {
    const mock = new AxiosMockAdapter(axios);
    try {
        const body = await fs.readFile("tests/test-cases/include-template/remote-mock.yml", "utf8");
        mock.onGet("https://gitlab.com/gitlab-org/gitlab/-/raw/HEAD/lib/gitlab/ci/templates/Workflows/MergeRequest-Pipelines.gitlab-ci.yml").reply(200, body);

        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-template",
            job: ["test-job"],
        }, writeStreams);

        const expected = [
            chalk`{blueBright test-job} {greenBright >} Test something`,
        ];
        expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    } finally {
        mock.restore();
    }
});
