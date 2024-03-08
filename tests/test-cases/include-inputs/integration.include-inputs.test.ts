import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
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
    - echo overwrite default value`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
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
