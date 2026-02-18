import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert, {AssertionError} from "assert";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("should be able to ignore 1 schemaPath", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-1.yml",
        cwd: "tests/test-cases/schema-validation-ignore",
        ignoreSchemaPaths: ["#/definitions/tags/minItems"],
        stateDir: ".gitlab-ci-local-should-be-able-to-ignore-1-schemapath",
    }, writeStreams);
});

test.concurrent("should be able to ignore 2 schemaPath", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-2.yml",
        cwd: "tests/test-cases/schema-validation-ignore",
        ignoreSchemaPaths: [
            "#/definitions/tags/minItems",
            "#/properties/reports/properties/junit/oneOf/0/type",
        ],
        stateDir: ".gitlab-ci-local-should-be-able-to-ignore-2-schemapath",
    }, writeStreams);
});

test.concurrent("should be still fail for schemaPath that's not ignored", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            file: ".gitlab-ci-2.yml",
            cwd: "tests/test-cases/schema-validation-ignore",
            noColor: true,
            ignoreSchemaPaths: [
                "#/properties/reports/properties/junit/oneOf/0/type",
            ],
            stateDir: ".gitlab-ci-local-should-be-still-fail-for-schemapath-that-s-not-ign",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: any) {
        const expected = `Invalid .gitlab-ci.yml configuration!
\t• property 'tags' must not have fewer than 1 items at job.tags [#/definitions/tags/minItems]
`;
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain(expected);
    }
});
