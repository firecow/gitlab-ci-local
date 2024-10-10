import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-inputs basic example", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/basic-example",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
scan-website:
  script:
    - echo hello website
    - echo hello website
    - echo hello website
scan-db:
  script:
    - echo hello db
    - echo hello db
    - echo hello db`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("include-inputs required inputs", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/required-inputs",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(
            chalk`\`{blueBright required_inputs}\` input: required value has not been provided`
        );
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs unknown interpolation key (TypeError)", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/unknown-interpolation-key-1",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(
            chalk`unknown interpolation key: \`foo\`.`
        );
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs unknown interpolation key (AssertionError)", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/unknown-interpolation-key-2",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(
            chalk`unknown interpolation key: \`foo\`.`
        );
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs defaults", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/default",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
scan-website:
  script:
    - echo string
    - echo 1
    - echo true
    - echo overwrite default value
    - alice
    - bob`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("include-inputs interpolation key containing hyphen", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/interpolation-key-hyphen",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
scan-website:
  script:
    - echo baz`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("include-inputs interpolation repeated", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/interpolation-repeat",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
job foo foo:
  script:
    - echo foofoo`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("include-inputs inputs validation for array", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/type-validation/array",
            preview: true,
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(chalk`\`{blueBright array_input}\` input: provided value is not a {blueBright array}.`);
    }
});

test("include-inputs inputs validation for string", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/type-validation/string",
            preview: true,
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(chalk`\`{blueBright string_input}\` input: provided value is not a {blueBright string}.`);
    }
});

test("include-inputs inputs validation for number", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/type-validation/number",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(chalk`\`{blueBright number_input}\` input: provided value is not a {blueBright number}.`);
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs for type array", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/types/array",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
test_job:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - ls`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("include-inputs for type boolean", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/types/boolean",
        preview: true,
        jsonSchemaValidation: true, // this test depends on the json schema validation, do not set to false
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
scan-website:
  script:
    - echo true`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test("include-inputs inputs validation for boolean", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/type-validation/boolean",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(chalk`\`{blueBright boolean_input}\` input: provided value is not a {blueBright boolean}.`);
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs inputs validation for unsupported type", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/type-validation/unsupported",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(
            chalk`header:spec:inputs:{blueBright unsupported_type_input} input type unknown value: {blueBright foo}.`
        );
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs options validation", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/options-validation",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain(
            chalk`\`{blueBright options_input}\` input: \`{blueBright fizz}\` cannot be used because it is not in the list of allowed options.`
        );
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});

test("include-inputs too many functions in interpolation block", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-inputs/input-templates/too-many-functions-in-interpolation-block",
            preview: true,
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid:");
        expect(e.message).toContain("too many functions in interpolation block.");
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});


test("include-inputs interpolation value containing escapes", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-inputs/input-templates/interpolation-value-escapes",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - test
  - .post
scan-website:
  script:
    - echo ^v?(?P<major>[0-9]+)\\.(?P<minor>[0-9]+)\\.(?P<patch>[0-9]+)(?P<suffix>(?P<prerelease>-[0-9A-Za-z-\\.]+)?(?P<build>\\+[0-9A-Za-z-\\.]+)?)$`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
