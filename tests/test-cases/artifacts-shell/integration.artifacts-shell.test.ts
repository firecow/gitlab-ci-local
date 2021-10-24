import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";

test.concurrent("artifacts-shell <consume> --needs --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-shell",
        job: ["consume"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    // Make sure pwd is changed to builds folder.
    const regex = new RegExp(`${process.cwd()}/tests/test-cases/artifacts-shell/.gitlab-ci-local/builds/consume`);
    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(regex) !== null;
    });
    expect(found.length).toEqual(1);
    expect(await fs.pathExists("tests/test-cases/artifacts-shell/path/file1")).toEqual(true);
    expect(writeStreams.stderrLines).toEqual([]);
});

test.concurrent("artifacts-shell --file .gitlab-ci-when-never.yml --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-shell",
        file: ".gitlab-ci-when-never.yml",
        shellIsolation: true,
    }, writeStreams);

     expect(writeStreams.stderrLines).toEqual([]);
});
