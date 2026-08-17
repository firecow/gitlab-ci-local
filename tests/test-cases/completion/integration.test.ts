import {execSync, spawnSync} from "child_process";

// Runs the CLI as a subprocess to reliably capture console.log output,
// which Bun implements natively and cannot be intercepted with vi.spyOn.
test("--completion outputs gitlab-ci-local as script name", () => {
    const output = execSync("bun src/index.ts --completion", {encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]});

    expect(output).toContain("###-begin-gitlab-ci-local-completions-###");
    expect(output).toContain("###-end-gitlab-ci-local-completions-###");
    expect(output).toContain("gitlab-ci-local --get-yargs-completions");
    expect(output).not.toMatch(/###-begin-(?!gitlab-ci-local)/);
});

// The .gitlab-ci.yml in this folder includes a local file that does not exist,
// so building the pipeline rejects while the shell is asking for completions.
test("completion reports a failed parse instead of crashing", () => {
    const {stdout, stderr, status} = spawnSync(
        "bun",
        ["src/index.ts", "--get-yargs-completions", "gitlab-ci-local", "--cwd", "tests/test-cases/completion", ""],
        {encoding: "utf8", shell: true},
    );

    expect(stderr).not.toContain("AssertionError");
    expect(stdout).toContain("Parser-Failed!");
    expect(status).toBe(0);
});
