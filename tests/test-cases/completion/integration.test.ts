import {execSync} from "child_process";

// Runs the CLI as a subprocess to reliably capture console.log output,
// which Bun implements natively and cannot be intercepted with vi.spyOn.
test("--completion outputs gitlab-ci-local as script name", () => {
    const output = execSync("bun src/index.ts --completion", {encoding: "utf8", stdio: ["pipe", "pipe", "pipe"]});

    expect(output).toContain("###-begin-gitlab-ci-local-completions-###");
    expect(output).toContain("###-end-gitlab-ci-local-completions-###");
    expect(output).toContain("gitlab-ci-local --get-yargs-completions");
    expect(output).not.toMatch(/###-begin-(?!gitlab-ci-local)/);
});
