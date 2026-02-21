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
        await fs.rm(`${cwd}/.gitlab-ci-local/`, {recursive: true, force: true});

        await handler({
            cwd,
            noColor: true,
            file: ".gitlab-ci.yml",
        }, writeStreams);
    });

    it("should successfully export artifacts with read-only directories", () => {
        expect(writeStreams.stdoutLines.join("\n")).toContain("produce-artifacts exported artifacts");
    });
});
