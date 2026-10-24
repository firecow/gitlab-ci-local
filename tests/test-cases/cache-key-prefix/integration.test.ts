import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {basename} from "node:path/posix";
import {dirname} from "node:path";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const name = basename(dirname(import.meta.url));
const cwd = `tests/test-cases/${name}`;

describe(name, () => {
    it("should produce prepand a string to the cache keys", async () => {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd,
            noColor: true,
            file: ".gitlab-ci-1.yml",
        }, writeStreams);

        const expected = [
            "cached/: found 2 artifact files and directories",
            "production-cache  cache created in '.gitlab-ci-local/cache/0_production-dd2c0eb6ea5cfc6c4bd4eac30934e2d5746747af48fef6da689e85b752f39557'",
            "development-cache cache created in '.gitlab-ci-local/cache/0_development-dd2c0eb6ea5cfc6c4bd4eac30934e2d5746747af48fef6da689e85b752f39557'",
        ];

        expected.forEach((e) => {
            expect(writeStreams.stdoutLines.join("\n")).toContain(e);
        });
    });
});

describe(name, () => {
    const writeStreams = new WriteStreamsMock();

    beforeAll(async () => {
        await handler({
            cwd,
            noColor: true,
            file: ".gitlab-ci-2.yml",
        }, writeStreams);
    });

    it("should support variable expansion", () => {
        expect(writeStreams.stdoutLines.join("\n")).toContain("rspec cache created in '.gitlab-ci-local/cache/0_rspec-89cade48462044ee1b672dc5f4c3ec250fbd29effcd8932096a23c1283c6731f'");
    });
});
