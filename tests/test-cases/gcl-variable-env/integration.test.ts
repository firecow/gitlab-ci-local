import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {injectGclVariableEnvVars} from "../../../src/argv.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

describe("injectGclVariableEnvVars unit tests", () => {
    test("injects single GCL_VARIABLE_ entry", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_MY_VAR": "hello"});
        expect(argv.variable).toEqual(["MY_VAR=hello"]);
    });

    test("injects multiple GCL_VARIABLE_ entries", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {
            "GCL_VARIABLE_VAR1": "one",
            "GCL_VARIABLE_VAR2": "two",
        });
        expect(argv.variable).toEqual(expect.arrayContaining(["VAR1=one", "VAR2=two"]));
        expect(argv.variable).toHaveLength(2);
    });

    test("prepends to existing variable array", () => {
        const argv: {variable?: string[]} = {variable: ["EXISTING=val"]};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_NEW": "injected"});
        expect(argv.variable).toEqual(["NEW=injected", "EXISTING=val"]);
    });

    test("CLI --variable takes precedence over GCL_VARIABLE_", () => {
        const argv: {variable?: string[]} = {variable: ["SAME=from_cli"]};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_SAME": "from_env"});
        // "SAME=from_env" is prepended, "SAME=from_cli" comes last and wins
        expect(argv.variable).toEqual(["SAME=from_env", "SAME=from_cli"]);
    });

    test("skips non GCL_VARIABLE_ env vars", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {
            "GCL_CWD": "/tmp",
            "HOME": "/home/user",
            "GCL_VARIABLE_REAL": "yes",
        });
        expect(argv.variable).toEqual(["REAL=yes"]);
    });

    test("skips GCL_VARIABLE_ with empty name", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_": "empty_name"});
        expect(argv.variable).toBeUndefined();
    });

    test("skips null/undefined env values", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_FOO": undefined});
        expect(argv.variable).toBeUndefined();
    });

    test("handles empty value", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_FOO": ""});
        expect(argv.variable).toEqual(["FOO="]);
    });

    test("handles value with equals sign", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_FOO": "key=value"});
        expect(argv.variable).toEqual(["FOO=key=value"]);
    });

    test("does not split on semicolons", () => {
        const argv: {variable?: string[]} = {};
        injectGclVariableEnvVars(argv, {"GCL_VARIABLE_FOO": "a;b;c"});
        expect(argv.variable).toEqual(["FOO=a;b;c"]);
    });
});

describe("injectGclVariableEnvVars integration via process.env", () => {
    test.concurrent("GCL_VARIABLE_* env vars are injected into job output", async () => {
        const envKeys = ["GCL_VARIABLE_MY_VAR", "GCL_VARIABLE_ANOTHER_VAR"];
        process.env["GCL_VARIABLE_MY_VAR"] = "hello";
        process.env["GCL_VARIABLE_ANOTHER_VAR"] = "world";
        try {
            const writeStreams = new WriteStreamsMock();
            await handler({
                cwd: "tests/test-cases/gcl-variable-env",
                job: ["test-job"],
            }, writeStreams);

            const expected = [
                chalk`{blueBright test-job} {greenBright >} hello`,
                chalk`{blueBright test-job} {greenBright >} world`,
            ];
            expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
        } finally {
            for (const key of envKeys) {
                delete process.env[key];
            }
        }
    });
});
