import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";
import fs from "fs-extra";
import chalk from "chalk";
import assert, {AssertionError} from "assert";

const originalDir = process.cwd();
const currentRelativeDir = "tests/test-cases/argv-cwd/dummy";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

describe("fallback cwd", () => {
    beforeEach(() => {
        fs.mkdirSync(currentRelativeDir);
    });

    afterEach(() => {
        process.chdir(originalDir);
        fs.rmSync("tests/test-cases/argv-cwd/.git", {recursive: true, force: true});
        fs.rmSync(currentRelativeDir, {recursive: true});
    });

    test("fallbacks to git root directory", async () => {
        process.chdir(currentRelativeDir);
        await Utils.bash("cd .. && git init");

        const writeStreams = new WriteStreamsMock();
        await handler({
            preview: true,
        }, writeStreams);

        const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
job:
  script:
    - echo hello world`;
        expect(writeStreams.stdoutLines[0]).toEqual(expected);
    });

    test("won't fallback if cwd has .gitlab-ci.yml", async () => {
        process.chdir(currentRelativeDir);
        await Utils.bash("cd .. && git init");
        await Utils.bash("cp ../.gitlab-ci-2.yml .gitlab-ci.yml");

        const writeStreams = new WriteStreamsMock();
        await handler({
            preview: true,
        }, writeStreams);

        const expected = `---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
job:
  script:
    - echo dlrow olleh`;

        expect(writeStreams.stdoutLines[0]).toEqual(expected);
    });

    test("won't fallback if not inside git repository", async () => {
        const {stdout: tmpDir} = await Utils.bash("realpath $(mktemp -d)");
        process.chdir(tmpDir);

        try {
            const writeStreams = new WriteStreamsMock();
            await handler({
                preview: true,
            }, writeStreams);
        } catch (e: any) {
            assert(e instanceof AssertionError, "e is not instanceof AssertionError");
            expect(e.message).toContain(chalk`--file (${tmpDir}/.gitlab-ci.yml) could not be found`);
        }
    });

    test("won't fallback if --file flag is set", async () => {
        process.chdir(currentRelativeDir);
        await Utils.bash("cd .. && git init");

        try {
            const writeStreams = new WriteStreamsMock();
            await handler({
                file: ".gitlab-ci.yml",
                preview: true,
            }, writeStreams);
        } catch (e: any) {
            assert(e instanceof AssertionError, "e is not instanceof AssertionError");
            expect(e.message).toEqual(chalk`--file (${originalDir}/${currentRelativeDir}/.gitlab-ci.yml) could not be found`);
        }
    });

    test("won't fallback if --cwd flag is set", async () => {
        process.chdir(currentRelativeDir);
        await Utils.bash("cd .. && git init");

        try {
            const writeStreams = new WriteStreamsMock();
            await handler({
                cwd: "",
                preview: true,
            }, writeStreams);
        } catch (e: any) {
            assert(e instanceof AssertionError, "e is not instanceof AssertionError");
            expect(e.message).toEqual(chalk`--file (${originalDir}/${currentRelativeDir}/.gitlab-ci.yml) could not be found`);
        }
    });

});
