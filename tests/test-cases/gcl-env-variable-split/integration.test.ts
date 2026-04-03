import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {splitSemicolonEnvVars} from "../../../src/argv.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {execFile} from "child_process";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

// --- Unit tests for splitSemicolonEnvVars ---

test("splits semicolon-separated GCL_VARIABLE into multiple values", () => {
    const argv: Record<string, any> = {variable: ["VAR1=hello;VAR2=world"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "VAR1=hello;VAR2=world"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["VAR1=hello", "VAR2=world"]);
});

test("splits three semicolon-separated values", () => {
    const argv: Record<string, any> = {variable: ["A=1;B=2;C=3"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1;B=2;C=3"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["A=1", "B=2", "C=3"]);
});

test("does not split when value has no semicolons", () => {
    const argv: Record<string, any> = {variable: ["VAR1=hello"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "VAR1=hello"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["VAR1=hello"]);
});

test("does not split when argv value differs from env (CLI-provided)", () => {
    const argv: Record<string, any> = {variable: ["CLI_VAR=host=db;port=5432"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "SOMETHING_ELSE=other"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["CLI_VAR=host=db;port=5432"]);
});

test("does not split when argv has multiple elements (CLI-provided array)", () => {
    const argv: Record<string, any> = {variable: ["A=1", "B=2"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1;B=2"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["A=1", "B=2"]);
});

test("skips non-GCL env vars", () => {
    const argv: Record<string, any> = {variable: ["VAR1=hello"]};
    const arrayKeys = new Set(["variable"]);
    const env = {OTHER_VARIABLE: "VAR1=hello;VAR2=world"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["VAR1=hello"]);
});

test("skips non-array options", () => {
    const argv: Record<string, any> = {cwd: ["some;path"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_CWD: "some;path"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.cwd).toEqual(["some;path"]);
});

test("handles empty env value", () => {
    const argv: Record<string, any> = {variable: [""]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: ""};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual([""]);
});

test("handles trailing semicolon", () => {
    const argv: Record<string, any> = {variable: ["A=1;"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1;"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["A=1", ""]);
});

test("handles consecutive semicolons", () => {
    const argv: Record<string, any> = {variable: ["A=1;;B=2"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1;;B=2"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["A=1", "", "B=2"]);
});

test("handles values with multiple equals signs", () => {
    const argv: Record<string, any> = {variable: ["A=1=2;B=3=4=5"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1=2;B=3=4=5"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["A=1=2", "B=3=4=5"]);
});

test("splits GCL_EXTRA_HOST (hyphenated option) correctly", () => {
    const argv: Record<string, any> = {extraHost: ["host1:1.2.3.4;host2:5.6.7.8"]};
    const arrayKeys = new Set(["extraHost"]);
    const env = {GCL_EXTRA_HOST: "host1:1.2.3.4;host2:5.6.7.8"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.extraHost).toEqual(["host1:1.2.3.4", "host2:5.6.7.8"]);
});

test("splits GCL_VOLUME correctly", () => {
    const argv: Record<string, any> = {volume: ["/src:/dst;/other:/path"]};
    const arrayKeys = new Set(["volume"]);
    const env = {GCL_VOLUME: "/src:/dst;/other:/path"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.volume).toEqual(["/src:/dst", "/other:/path"]);
});

test("splits GCL_NETWORK correctly", () => {
    const argv: Record<string, any> = {network: ["net1;net2"]};
    const arrayKeys = new Set(["network"]);
    const env = {GCL_NETWORK: "net1;net2"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.network).toEqual(["net1", "net2"]);
});

test("splits multiple GCL_ array options simultaneously", () => {
    const argv: Record<string, any> = {
        variable: ["A=1;B=2"],
        volume: ["/src:/dst;/other:/path"],
        network: ["net1;net2"],
    };
    const arrayKeys = new Set(["variable", "volume", "network"]);
    const env = {
        GCL_VARIABLE: "A=1;B=2",
        GCL_VOLUME: "/src:/dst;/other:/path",
        GCL_NETWORK: "net1;net2",
    };
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["A=1", "B=2"]);
    expect(argv.volume).toEqual(["/src:/dst", "/other:/path"]);
    expect(argv.network).toEqual(["net1", "net2"]);
});

test("skips env var when argv option is undefined", () => {
    const argv: Record<string, any> = {};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1;B=2"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toBeUndefined();
});

test("skips env var with null value", () => {
    const argv: Record<string, any> = {variable: ["something"]};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: undefined};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toEqual(["something"]);
});

test("does not split non-array argv value", () => {
    const argv: Record<string, any> = {variable: "A=1;B=2"};
    const arrayKeys = new Set(["variable"]);
    const env = {GCL_VARIABLE: "A=1;B=2"};
    splitSemicolonEnvVars(argv, arrayKeys, env);
    expect(argv.variable).toBe("A=1;B=2");
});

// --- Integration test: semicolon-split variables reach the job ---

test("GCL_VARIABLE env split reaches handler as separate variables", async () => {
    const writeStreams = new WriteStreamsMock();
    const argv: Record<string, any> = {
        cwd: "tests/test-cases/gcl-env-variable-split",
        job: ["test-job"],
        variable: ["VAR1=hello;VAR2=world"],
    };
    splitSemicolonEnvVars(argv, new Set(["variable"]), {GCL_VARIABLE: "VAR1=hello;VAR2=world"});
    await handler(argv, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} hello`,
        chalk`{blueBright test-job} {greenBright >} world`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

// --- Integration test: spawns real CLI with GCL_VARIABLE env ---

function runCli (envVars: Record<string, string>): Promise<{stdout: string; exitCode: number}> {
    return new Promise((resolve, reject) => {
        execFile("bun", ["src/index.ts", "test-job", "--cwd", "tests/test-cases/gcl-env-variable-split"], {
            env: {...process.env, ...envVars},
        }, (error, stdout) => {
            if (error && error.code === undefined) return reject(error);
            resolve({stdout, exitCode: typeof error?.code === "number" ? error.code : 0});
        });
    });
}

test("GCL_VARIABLE env var is split by CLI middleware", async () => {
    const {stdout, exitCode} = await runCli({GCL_VARIABLE: "VAR1=from_env1;VAR2=from_env2"});
    expect(exitCode).toBe(0);
    expect(stdout).toContain("from_env1");
    expect(stdout).toContain("from_env2");
}, 30_000);

test("GCL_VARIABLE with single value (no semicolon) works via CLI", async () => {
    const {stdout, exitCode} = await runCli({GCL_VARIABLE: "VAR1=single_value"});
    expect(exitCode).toBe(0);
    expect(stdout).toContain("single_value");
}, 30_000);

test("GCL_VARIABLE with three semicolon-separated values via CLI", async () => {
    const {stdout, exitCode} = await runCli({GCL_VARIABLE: "VAR1=first;VAR2=second;VAR3=third"});
    expect(exitCode).toBe(0);
    expect(stdout).toContain("first");
    expect(stdout).toContain("second");
    expect(stdout).toContain("third");
}, 30_000);
