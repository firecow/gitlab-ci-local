import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Argv} from "../../../src/argv.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("shell defaults to bash", async () => {
    const argv = await Argv.build({home: "tests/test-cases/shell-powershell"});
    expect(argv.shell).toBe("bash");
    expect(argv.isPowerShell).toBe(false);
});

test("shell powershell and pwsh set isPowerShell", async () => {
    const powershell = await Argv.build({home: "tests/test-cases/shell-powershell", shell: "powershell"});
    expect(powershell.shell).toBe("powershell");
    expect(powershell.isPowerShell).toBe(true);

    const pwsh = await Argv.build({home: "tests/test-cases/shell-powershell", shell: "pwsh"});
    expect(pwsh.shell).toBe("pwsh");
    expect(pwsh.isPowerShell).toBe(true);
});

test("shell rejects invalid values", async () => {
    await expect(Argv.build({home: "tests/test-cases/shell-powershell", shell: "cmd"}))
        .rejects.toThrow(/--shell must be one of/);
});

test("shell is loaded from .gitlab-ci-local-env", async () => {
    const argv = await Argv.build({
        cwd: "tests/test-cases/shell-powershell",
        home: "tests/test-cases/shell-powershell",
    });
    expect(argv.shell).toBe("pwsh");
    expect(argv.isPowerShell).toBe(true);
});

test("shell powershell runs PowerShell syntax and env vars", async () => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: ["test-job"],
        shell: "powershell",
        variable: ["MY_VAR=from-env"],
        noColor: true,
        stateDir: ".gitlab-ci-local-shell-powershell",
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toMatch(/hello from powershell/);
    expect(stdout).toMatch(/MY_VAR=from-env/);
});

test("shell pwsh runs PowerShell syntax and env vars", async () => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: ["test-job"],
        shell: "pwsh",
        variable: ["MY_VAR=from-env"],
        noColor: true,
        stateDir: ".gitlab-ci-local-shell-pwsh",
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toMatch(/hello from powershell/);
    expect(stdout).toMatch(/MY_VAR=from-env/);
});

test("shell powershell fails on throw", async () => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: ["fail-job"],
        shell: "powershell",
        noColor: true,
        stateDir: ".gitlab-ci-local-shell-powershell-fail",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/fail-job/);
    expect(writeStreams.stderrLines.join("\n")).toMatch(/WARN/);
});

test.each(["powershell", "pwsh"])("shell %s stops on failing native command with its exit code", async (shell) => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: ["native-fail-job"],
        shell,
        noColor: true,
        stateDir: `.gitlab-ci-local-shell-${shell}-native-fail`,
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toMatch(/WARN\s+native-fail-job\s+pre_script/);
    expect(stdout).not.toMatch(/> not printed/);
});
