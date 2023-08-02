import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import fs from "fs-extra";
import chalk from "chalk";

jest.setTimeout(30000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-docker <consume artifacts> --needs", async () => {
    await fs.promises.rm("tests/test-cases/artifacts-docker/.gitlab-ci-local", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-docker",
        job: ["consume artifacts 🏗️"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright produce artifacts 📝 } {greenBright >} CI_PROJECT_DIR=/gcl-builds`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    expect(fs.pathExistsSync("tests/test-cases/artifacts-docker/.gitlab-ci-local/artifacts/produceIAartifactsIPCfk50/file2")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-docker/.gitlab-ci-local/artifacts/produceIAartifactsIPCfk50/path/to/deep/folder/file3")).toBe(true);
});
