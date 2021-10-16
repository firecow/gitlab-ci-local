import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";

test.concurrent("cache-key-files <consume-cache> --shell-isolation --needs", async () => {
    await fs.rm("tests/test-cases/cache-key-files/.gitlab-ci-local/cache/", {recursive: true, force:true});
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        job: ["consume-cache"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
