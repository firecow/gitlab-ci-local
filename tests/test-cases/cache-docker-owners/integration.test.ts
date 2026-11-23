import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("cache-docker-owners <consume-caches> restores the cache with the uid/gid it was saved with", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-cache-docker-owners";
    const cwd = "tests/test-cases/cache-docker-owners";
    await fs.rm(`${cwd}/${stateDir}`, {recursive: true, force: true});

    await handler({
        cwd,
        noColor: true,
        file: ".gitlab-ci.yml",
        stateDir,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain("PASS  consume-caches");
    expect(writeStreams.stderrLines.join("\n")).not.toContain("could not restore the owner");
});

test("cache-docker-owners <consume-cache> warns when an owner can't be restored and keeps going", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-cache-docker-owners-chown-failure";
    const cwd = "tests/test-cases/cache-docker-owners";
    const file = ".gitlab-ci-chown-failure.yml";
    await fs.rm(`${cwd}/${stateDir}`, {recursive: true, force: true});

    await handler({cwd, noColor: true, file, stateDir, job: ["produce-cache"]}, writeStreams);
    // A path that no longer exists makes chown fail, as an unmapped uid does under rootless docker
    await fs.writeFile(`${cwd}/${stateDir}/cache/.gitlab-ci-local-owners/chown-failure/3000_3000`, "./kept/missing.txt\0");
    await handler({cwd, noColor: true, file, stateDir, job: ["consume-cache"]}, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain("PASS  consume-cache");
    // The empty cache has an owners folder with no lists in it, which must not warn
    const warnings = writeStreams.stderrLines.filter((line) => line.includes("could not restore the owner"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("could not restore the owner of 1 cached path(s), first error: chown: cannot");
});
