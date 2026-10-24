import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("include-template <test-job>", async () => {
    const bodies: Record<string, string> = {
        "https://gitlab.com/gitlab-org/gitlab/-/raw/HEAD/lib/gitlab/ci/templates/Workflows/MergeRequest-Pipelines.gitlab-ci.yml": await fs.readFile("tests/test-cases/include-template/remote-mock.yml", "utf8"),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => String(url) in bodies ? new Response(bodies[String(url)]) : new Response(null, {status: 404}));
    try {

        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-template",
            job: ["test-job"],
            stateDir: ".gitlab-ci-local-include-template",
        }, writeStreams);

        const expected = [
            chalk`{blueBright test-job} {greenBright >} Test something`,
        ];
        expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    } finally {
        fetchSpy.mockRestore();
    }
});
