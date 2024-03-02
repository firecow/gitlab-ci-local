import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import assert, {AssertionError} from "assert";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-local-wildcard <build-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-local-wildcard",
            file: ".gitlab-ci.yml",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual(chalk`This GitLab CI configuration is invalid: Maximum of {blueBright 150} nested includes are allowed!.`);
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});
