import path from "node:path";
import fs from "fs-extra";
import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

const cwd = "tests/test-cases/rsync-untracked-exclude";
const untracked = path.join(cwd, "untracked.marker");

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
    fs.writeFileSync(untracked, "untracked\n");
});

afterAll(() => {
    fs.removeSync(untracked);
});

test("shell isolation syncs tracked files and excludes untracked ones", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd,
        shellIsolation: true,
        noColor: true,
        stateDir: ".gitlab-ci-local-rsync-untracked-exclude",
    }, writeStreams);

    const markers = writeStreams.stdoutLines.filter(l => l.startsWith("test-job > "));
    expect(markers).toEqual(["test-job > ./tracked.marker"]);

    // rsync 3.5.0 cannot read an exclude file from a process substitution, so the
    // untracked list has to reach it as a real file on disk.
    const excludeFile = path.join(cwd, ".gitlab-ci-local-rsync-untracked-exclude", "rsync-exclude-test-job");
    expect(fs.readFileSync(excludeFile, "utf8")).toContain("/untracked.marker");
});
