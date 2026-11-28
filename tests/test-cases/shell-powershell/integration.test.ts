import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Argv} from "../../../src/argv.js";
import {insertPowerShellStatusChecks} from "../../../src/powershell-script.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

const statusCheck = "if(!$?) { Exit &{if($LASTEXITCODE) {$LASTEXITCODE} else {1}} }";

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
    expect(writeStreams.stderrLines.join("\n")).toMatch(/WARN 3/);
    expect(stdout).not.toMatch(/> not printed/);
});

test("powershell status checks follow complete statements", async () => {
    if (process.platform !== "win32") {
        return;
    }

    const [sequential, ifelse, tryCatch, pipeline, here, scriptBlock, broken] = await insertPowerShellStatusChecks("powershell", [
        "cmd /c exit 3\nWrite-Output \"not printed\"",
        "if ($true)\n{\n  Write-Output \"split-if\"\n}\nelse\n{\n  throw \"no\"\n}",
        "try {\n  Get-Item missing -ErrorAction Stop\n} catch {\n  Write-Output \"caught\"\n}",
        "\"a\",\"b\" |\n  Where-Object { $_ -eq \"a\" }",
        "$msg = @\"\nhello\n\"@\nWrite-Output $msg",
        "1..1 | ForEach-Object {\n  cmd /c exit 3\n  Write-Output \"not printed\"\n}",
        "if (",
    ]);

    expect(sequential.indexOf(statusCheck)).toBeLessThan(sequential.indexOf("Write-Output"));
    expect(sequential.split(statusCheck)).toHaveLength(3);

    expect(ifelse).toMatch(/\}\s*else\s*\{/);
    expect(ifelse.indexOf(`Write-Output "split-if"\n${statusCheck}`)).toBeGreaterThan(-1);
    expect(ifelse.indexOf(`throw "no"\n${statusCheck}`)).toBeGreaterThan(-1);

    expect(tryCatch).toMatch(/\}\s*catch\s*\{/);
    expect(tryCatch.indexOf(`Get-Item missing -ErrorAction Stop\n${statusCheck}`)).toBeGreaterThan(-1);
    expect(tryCatch.indexOf(`Write-Output "caught"\n${statusCheck}`)).toBeGreaterThan(-1);

    expect(pipeline.slice(pipeline.indexOf("|"), pipeline.indexOf("Where-Object"))).not.toContain(statusCheck);
    expect(pipeline.indexOf(`$_ -eq "a"\n${statusCheck}`)).toBeGreaterThan(-1);
    expect(pipeline.trimEnd().endsWith(statusCheck)).toBe(true);

    expect(here.slice(0, here.indexOf("\"@"))).not.toContain(statusCheck);
    expect(here.indexOf(statusCheck)).toBeLessThan(here.indexOf("Write-Output"));

    expect(scriptBlock.indexOf(`cmd /c exit 3\n${statusCheck}`)).toBeGreaterThan(-1);
    expect(scriptBlock.indexOf(statusCheck)).toBeLessThan(scriptBlock.indexOf("Write-Output"));

    expect(broken).toBe("if (");
});

test.each(["powershell", "pwsh"])("shell %s stops on a failing native command inside a multiline script", async (shell) => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: ["native-fail-multiline"],
        shell,
        noColor: true,
        stateDir: `.gitlab-ci-local-shell-${shell}-native-fail-multiline`,
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toMatch(/WARN\s+native-fail-multiline\s+pre_script/);
    expect(writeStreams.stderrLines.join("\n")).toMatch(/WARN 3/);
    expect(stdout).not.toMatch(/> not printed/);
});

test.each([
    ["powershell", "native-fail-semicolon"],
    ["pwsh", "native-fail-semicolon"],
    ["powershell", "native-fail-assign"],
    ["pwsh", "native-fail-assign"],
    ["powershell", "native-fail-if"],
    ["pwsh", "native-fail-if"],
    ["powershell", "native-fail-scriptblock"],
    ["pwsh", "native-fail-scriptblock"],
])("shell %s stops native failures in %s", async (shell, job) => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: [job],
        shell,
        noColor: true,
        stateDir: `.gitlab-ci-local-shell-${shell}-${job}`,
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toMatch(new RegExp(`WARN\\s+${job}\\s+pre_script`));
    expect(writeStreams.stderrLines.join("\n")).toMatch(/WARN 3/);
    expect(stdout).not.toMatch(/> not printed/);
    expect(stdout).not.toMatch(/> from-else/);
    expect(stdout).not.toMatch(/> after-if/);
    expect(stdout).not.toMatch(/> after-loop/);
});

test.each(["powershell", "pwsh"])("shell %s runs multiline powershell constructs", async (shell) => {
    if (process.platform !== "win32") {
        return;
    }

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shell-powershell",
        job: ["syntax-job"],
        shell,
        noColor: true,
        stateDir: `.gitlab-ci-local-shell-${shell}-syntax`,
    }, writeStreams);

    const stdout = writeStreams.stdoutLines.join("\n");
    const stderr = writeStreams.stderrLines.join("\n");
    for (const line of ["from-if", "after-if", "split-if", "caught", "after-try", "pipe-a", "here-ok", "switch-two", "from-function", "after-success", "do-1"]) {
        expect(stdout).toMatch(new RegExp(`> ${line}`));
    }
    expect(stdout).not.toMatch(/> from-else/);
    expect(stdout).not.toMatch(/> split-else/);
    expect(stdout).not.toMatch(/> try-continued/);
    expect(stdout).not.toMatch(/> switch-one/);
    expect(stdout).not.toMatch(/> switch-default/);
    expect(stderr).not.toMatch(/FAIL/);
    expect(stdout).not.toMatch(/WARN\s+syntax-job/);
});
