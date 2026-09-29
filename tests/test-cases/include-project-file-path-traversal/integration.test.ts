import {vi} from "vitest";
import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {Utils} from "../../../src/utils.js";
import fs from "fs-extra";
import path from "node:path";

test("include-project-file-path-traversal", async () => {
    const cwd = "tests/test-cases/include-project-file-path-traversal";
    const stateDir = ".gitlab-ci-local";
    const includeFile = "../victim file.yml";
    await fs.rm(`${cwd}/${stateDir}/`, {recursive: true, force: true});

    initSpawnSpy([...WhenStatics.all, WhenStatics.mockGitRemoteHttp]);
    const bashMultiSpy = vi.spyOn(Utils, "bashMulti").mockResolvedValue({stdout: "", stderr: ""});
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const copySpy = vi.spyOn(fs, "copy");

    const includesRoot = `${cwd}/${stateDir}/includes/gitlab.com/some/project`;
    const tmpDir = `${includesRoot}/main.tmp-0.5`;
    await fs.mkdirp(tmpDir);
    await fs.outputFile(`${includesRoot}/victim file.yml`, "should-not-be-copied: true\n");

    const writeStreams = new WriteStreamsMock();
    await expect(handler({cwd, fetchIncludes: true}, writeStreams)).rejects.toThrow(/escapes the fetched project/);

    expect(copySpy).not.toHaveBeenCalled();

    const bashScripts = bashMultiSpy.mock.calls.flatMap(([scripts]) => scripts);
    expect(bashScripts).toContain(`cd '${path.resolve(tmpDir)}'`);
    expect(bashScripts).toContain(`git sparse-checkout set --no-cone ${Utils.safeBashString(includeFile)}`);
});
