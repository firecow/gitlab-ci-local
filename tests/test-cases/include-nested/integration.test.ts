import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import assert, {AssertionError} from "assert";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk-template";
import {ParserIncludes} from "../../../src/parser-includes.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

beforeEach(() => {
    ParserIncludes.resetCount();
});

test.concurrent("include-nested 150 nested include", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-nested",
        file: ".150-nested-include-gitlab-ci.yml",
        preview: true,
        stateDir: ".gitlab-ci-local-include-nested-150",
    }, writeStreams);

});

test.concurrent("include-nested 151 nested include", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-nested",
            file: ".151-nested-include-gitlab-ci.yml",
            preview: true,
            stateDir: ".gitlab-ci-local-include-nested-151",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual(chalk`This GitLab CI configuration is invalid: Maximum of {blueBright 150} nested includes are allowed!. This limit can be increased with the --maximum-includes cli flags.`);
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test.concurrent("include-nested 150 complex nested include", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-nested",
        file: ".150-complex-nested-include-gitlab-ci.yml",
        preview: true,
        stateDir: ".gitlab-ci-local-include-nested-150-complex",
    }, writeStreams);
});

test.concurrent("include-nested 151 complex nested include", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-nested",
            file: ".151-complex-nested-include-gitlab-ci.yml",
            preview: true,
            stateDir: ".gitlab-ci-local-include-nested-151-complex",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual(chalk`This GitLab CI configuration is invalid: Maximum of {blueBright 150} nested includes are allowed!. This limit can be increased with the --maximum-includes cli flags.`);
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test.concurrent("include-nested maximumIncludes args", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-nested",
            file: ".151-complex-nested-include-gitlab-ci.yml",
            maximumIncludes: 3,
            preview: true,
            stateDir: ".gitlab-ci-local-include-nested-maximum-includes",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual(chalk`This GitLab CI configuration is invalid: Maximum of {blueBright 3} nested includes are allowed!. This limit can be increased with the --maximum-includes cli flags.`);
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});
