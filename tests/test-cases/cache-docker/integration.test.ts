import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
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
    const writeStreams = new WriteStreamsMock();
    beforeAll(async () => {
        await fs.rm(`${cwd}/.gitlab-ci-local/cache/`, {recursive: true, force: true}); // to ensure that the cache from previous runs gets deleted

        await handler({
            cwd,
            noColor: true,
            file: ".gitlab-ci.yml",
        }, writeStreams);
    });

    it("should show export cache message", () => {
        expect(writeStreams.stdoutLines.join("\n")).toContain("produce-cache cache created in '.gitlab-ci-local/cache/maven'");
    });

    it("should show the correct number of files that's exported", () => {
        expect(writeStreams.stdoutLines.join("\n")).toContain(".cache: found 4 artifact files and directories");
        expect(writeStreams.stdoutLines.join("\n")).toContain(".cache/: found 4 artifact files and directories");
        expect(writeStreams.stdoutLines.join("\n")).toContain(".cache/*: found 3 artifact files and directories");
        // NOTE: gitlab.com shows .cache/**: found 7 matching artifact files and directories
        //       i can't make any sense of it, i think it's probably a bug?
        expect(writeStreams.stdoutLines.join("\n")).toContain(".cache/**: found 3 artifact files and directories");
        expect(writeStreams.stdoutLines.join("\n")).toContain(".cache2/*/bar: found 4 artifact files and directories");
        expect(writeStreams.stdoutLines.join("\n")).toContain(".cache2/**/bar: found 4 artifact files and directories");
        expect(writeStreams.stdoutLines.join("\n")).toContain("WARNING: .cache3: no matching files. Ensure that the artifact path is relative to the working directory");
        expect(writeStreams.stdoutLines.join("\n")).toContain("WARNING: processPath: artifact path is not a subpath of project directory: /tmp");
    });

    it("should export cache to local fs", () => {
        expect(fs.existsSync(`${cwd}/.gitlab-ci-local/cache/maven`)).toBe(true);
    });

    it("should be pull the cache with the expected content", () => {
        // The assertions are done via the consume-cache job's script
        expect(writeStreams.stdoutLines.join("\n")).toContain("PASS  consume-cache");
    });
});
