import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("include-remote <test-job|build-job>", async () => {
    const bodies: Record<string, string> = {
        "https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.gitlab-http.yml": await fs.readFile("tests/test-cases/include-remote/remote-mock.yml", "utf8"),
        "https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.gitlab-http1.yml": await fs.readFile("tests/test-cases/include-remote/remote-mock1.yml", "utf8"),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => String(url) in bodies ? new Response(bodies[String(url)]) : new Response(null, {status: 404}));
    try {

        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-remote",
            job: ["test-job", "build-job"],
            stateDir: ".gitlab-ci-local-include-remote",
        }, writeStreams);

        const expected = [
            chalk`{blueBright test-job } {greenBright >} Test something`,
            chalk`{blueBright build-job} {greenBright >} Build something`,
        ];
        expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    } finally {
        fetchSpy.mockRestore();
    }
});
