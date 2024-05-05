import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";

jest.setTimeout(45000);

beforeAll(() => {
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/cache-docker-mount.git"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
});

test("cache-docker-mount <consume-cache> --mount-cache --needs", async () => {
    void Utils.spawn(["docker", "volume", "rm", "-f", "gcl-gcl-cache-docker-mount-mavenLw"]);
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-docker-mount",
        job: ["consume-cache"],
        needs: true,
        mountCache: true,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/cache-docker-mount/.gitlab-ci-local/cache/maven/")).toEqual(false);
    expect((await Utils.bash("docker volume ls | grep -w gcl-gcl-cache-docker-mount-mavenLw")).exitCode).toBe(0);

});
