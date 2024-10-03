import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const cwd = `${process.cwd()}/tests/test-cases/custom-state-dir`;

describe("--state-dir <absolute-path>", () => {
    const customHomeDir = `${process.cwd()}/tests/test-cases/custom-state-dir/custom-gitlab-ci-local`;
    afterAll(() => {
        fs.rmSync(customHomeDir, {recursive: true});
    });

    test("", async () => {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: cwd,
            stateDir: customHomeDir,
        }, writeStreams);

        const expected = [
            chalk`{blueBright job} {greenBright >} Test something`,
        ];
        expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

        const uniqueStateDir = cwd.replaceAll("/", ".");

        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}`)).toEqual(true);
        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}/builds`)).toEqual(true);
        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}/output`)).toEqual(true);
        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}/scripts`)).toEqual(true);
        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}/expanded-gitlab-ci.yml`)).toEqual(true);
        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}/state.yml`)).toEqual(true);

        expect(fs.pathExistsSync(`${customHomeDir}/${uniqueStateDir}/.gitignore`)).toEqual(false);
    });
});

describe("--state-dir <relative-path>", () => {
    const customHomeDir = "relative-custom-gitlab-ci-local";
    afterAll(() => {
        fs.rmSync(`${cwd}/${customHomeDir}`, {recursive: true});
    });

    test("", async () => {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: cwd,
            stateDir: customHomeDir,
        }, writeStreams);

        const expected = [
            chalk`{blueBright job} {greenBright >} Test something`,
        ];
        expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

        expect(fs.pathExistsSync(`${cwd}/${customHomeDir}/builds`)).toEqual(true);
        expect(fs.pathExistsSync(`${cwd}/${customHomeDir}/output`)).toEqual(true);
        expect(fs.pathExistsSync(`${cwd}/${customHomeDir}/scripts`)).toEqual(true);
        expect(fs.pathExistsSync(`${cwd}/${customHomeDir}/expanded-gitlab-ci.yml`)).toEqual(true);
        expect(fs.pathExistsSync(`${cwd}/${customHomeDir}/state.yml`)).toEqual(true);
        expect(fs.pathExistsSync(`${cwd}/${customHomeDir}/.gitignore`)).toEqual(true);
    });
});
