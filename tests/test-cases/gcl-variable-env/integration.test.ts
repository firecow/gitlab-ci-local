import {injectGclVariableEnvVars, injectGclEnvVars} from "../../../src/argv.js";
import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);

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

describe("injectGclEnvVars unit tests", () => {
    const baseOptions = {
        array: ["volume"],
        boolean: ["quiet"],
        number: ["concurrency"],
        default: {quiet: false, concurrency: 0, cwd: "."},
        key: {quiet: true, concurrency: true, cwd: true, volume: true, _: true, $0: true, "some-kebab": true},
    };

    test("injects string env var", () => {
        const argv: Record<string, any> = {cwd: ".", quiet: false};
        injectGclEnvVars(argv, baseOptions, {"GCL_CWD": "/tmp/test"}, {cwd: true, quiet: true});
        expect(argv.cwd).toBe("/tmp/test");
    });

    test("injects boolean env var", () => {
        const argv: Record<string, any> = {quiet: false};
        injectGclEnvVars(argv, baseOptions, {"GCL_QUIET": "true"}, {quiet: true});
        expect(argv.quiet).toBe(true);
    });

    test("injects boolean env var from '1'", () => {
        const argv: Record<string, any> = {quiet: false};
        injectGclEnvVars(argv, baseOptions, {"GCL_QUIET": "1"}, {quiet: true});
        expect(argv.quiet).toBe(true);
    });

    test("injects number env var", () => {
        const argv: Record<string, any> = {concurrency: 0};
        injectGclEnvVars(argv, baseOptions, {"GCL_CONCURRENCY": "4"}, {concurrency: true});
        expect(argv.concurrency).toBe(4);
    });

    test("splits array env var on semicolons", () => {
        const argv: Record<string, any> = {volume: []};
        injectGclEnvVars(argv, baseOptions, {"GCL_VOLUME": "/a:/b;/c:/d"}, {volume: true});
        expect(argv.volume).toEqual(["/a:/b", "/c:/d"]);
    });

    test("merges array env var with CLI values", () => {
        const argv: Record<string, any> = {volume: ["/cli:/path"]};
        injectGclEnvVars(argv, baseOptions, {"GCL_VOLUME": "/env:/path"}, {});
        expect(argv.volume).toEqual(["/env:/path", "/cli:/path"]);
    });

    test("CLI explicit value takes precedence over env", () => {
        const argv: Record<string, any> = {concurrency: 8};
        injectGclEnvVars(argv, baseOptions, {"GCL_CONCURRENCY": "4"}, {});
        expect(argv.concurrency).toBe(8);
    });

    test("CLI explicit value takes precedence even when matching default", () => {
        const argv: Record<string, any> = {concurrency: 0};
        injectGclEnvVars(argv, baseOptions, {"GCL_CONCURRENCY": "4"}, {});
        expect(argv.concurrency).toBe(0);
    });

    test("env overrides when value was defaulted", () => {
        const argv: Record<string, any> = {concurrency: 0};
        injectGclEnvVars(argv, baseOptions, {"GCL_CONCURRENCY": "4"}, {concurrency: true});
        expect(argv.concurrency).toBe(4);
    });

    test("skips keys with hyphens", () => {
        const argv: Record<string, any> = {};
        injectGclEnvVars(argv, baseOptions, {"GCL_SOME_KEBAB": "val"}, {});
        expect(argv["some-kebab"]).toBeUndefined();
    });

    test("skips _ and $0 keys", () => {
        const argv: Record<string, any> = {_: [], $0: "bin"};
        injectGclEnvVars(argv, baseOptions, {"GCL__": "x", "GCL_$0": "y"}, {});
        expect(argv._).toEqual([]);
        expect(argv.$0).toBe("bin");
    });

    test("skips undefined env values", () => {
        const argv: Record<string, any> = {quiet: false};
        injectGclEnvVars(argv, baseOptions, {"GCL_QUIET": undefined}, {quiet: true});
        expect(argv.quiet).toBe(false);
    });
});

test("GCL_VARIABLE_* env vars are injected into job output via CLI", async () => {
    const {stdout} = await execFileAsync("bun", ["src/index.ts", "test-job", "--cwd", "tests/test-cases/gcl-variable-env"], {
        env: {
            ...process.env,
            GCL_VARIABLE_MY_VAR: "hello",
            GCL_VARIABLE_ANOTHER_VAR: "world",
        },
    });

    expect(stdout).toContain("hello");
    expect(stdout).toContain("world");
}, 30_000);
