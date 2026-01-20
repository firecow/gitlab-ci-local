import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {Parser} from "../../../src/parser.js";
import {Argv} from "../../../src/argv.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

/**
 * Unit test for issue #1725: Verify that environment object cloning works correctly.
 *
 * This test directly verifies the fix logic: when jobData.environment is an object,
 * it should be cloned (not assigned by reference) to prevent mutation side effects.
 *
 * The bug: Without cloning, all matrix jobs share the same environment object.
 * When the first job expands "$CLUSTER" to "cluster-a", it mutates the shared object,
 * so subsequent jobs see "cluster-a" instead of "$CLUSTER".
 */
test("parallel-matrix-environment - environment object cloning prevents mutation", () => {
    // Simulate what the Job constructor does with environment
    const jobData = {
        environment: { name: "$CLUSTER" }
    };

    // THE FIX: Clone the environment object instead of assigning by reference
    // Fixed code:   this.environment = {...jobData.environment}
    // Buggy code:   this.environment = jobData.environment
    const cloneEnvironment = (env: any) => {
        return typeof env === "string" ? { name: env } : (env ? { ...env } : env);
    };

    // Simulate creating two jobs from the same jobData
    const job1Env = cloneEnvironment(jobData.environment);
    const job2Env = cloneEnvironment(jobData.environment);

    // With the fix, they should be different object references
    expect(job1Env).not.toBe(job2Env);
    expect(job1Env).not.toBe(jobData.environment);
    expect(job2Env).not.toBe(jobData.environment);

    // Simulate job1 expanding its environment name (mutating its own copy)
    job1Env.name = "cluster-a";

    // With the fix, job2's environment should still have the original template
    expect(job2Env.name).toBe("$CLUSTER");
    // And the original jobData should be unchanged
    expect(jobData.environment.name).toBe("$CLUSTER");
});

/**
 * This test verifies what happens WITHOUT the fix (buggy behavior).
 * It demonstrates the bug that the fix addresses.
 */
test("parallel-matrix-environment - demonstrates bug without cloning", () => {
    const jobData = {
        environment: { name: "$CLUSTER" }
    };

    // BUGGY CODE: Direct assignment without cloning
    const buggyAssign = (env: any) => {
        return typeof env === "string" ? { name: env } : env; // No spread!
    };

    const job1Env = buggyAssign(jobData.environment);
    const job2Env = buggyAssign(jobData.environment);

    // Without cloning, they ARE the same reference
    expect(job1Env).toBe(job2Env);
    expect(job1Env).toBe(jobData.environment);

    // When job1 "expands" its environment name...
    job1Env.name = "cluster-a";

    // ...it corrupts job2's environment AND the original jobData!
    expect(job2Env.name).toBe("cluster-a"); // BUG: Should be "$CLUSTER"
    expect(jobData.environment.name).toBe("cluster-a"); // BUG: Original mutated
});

/**
 * Regression test for issue #1725: Verify the fix is present in job.ts
 *
 * This test reads the actual source code and verifies that the environment
 * object is cloned using the spread operator. This prevents accidental
 * removal of the fix.
 */
test("parallel-matrix-environment - job.ts contains environment cloning fix", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const {fileURLToPath} = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const jobTsPath = path.resolve(__dirname, "../../../src/job.ts");
    const content = fs.readFileSync(jobTsPath, "utf-8");

    // The fix: environment object should be cloned with spread operator
    // Look for the pattern: {...jobData.environment} or { ...jobData.environment }
    const hasSpreadOperator = /\{\s*\.\.\.jobData\.environment\s*\}/.test(content);

    expect(hasSpreadOperator).toBe(true);
});

/**
 * Test for issue #1725: Environment-scoped variables don't work with matrix jobs
 * due to shared jobData mutation.
 *
 * When using parallel matrix jobs with dynamic environment names (e.g., environment: name: $CLUSTER),
 * each matrix job should have its own expanded environment name, not the first job's value.
 *
 * The bug was that jobData.environment was assigned by reference, so when the first job
 * expanded $CLUSTER to "cluster-a", it mutated the shared object, causing all subsequent
 * jobs to see "cluster-a" instead of their own cluster name.
 */
test("parallel-matrix-environment - each job gets correct environment name", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel-matrix-environment",
        job: ["run-all-clusters"],
    }, writeStreams);

    // Each matrix job should have its environment name expanded to its own CLUSTER value
    // The bug caused all jobs to get the first job's expanded environment name
    const expected = [
        chalk`{blueBright run-all-clusters: [cluster-a]} environment: \{ name: {bold cluster-a} \}`,
        chalk`{blueBright run-all-clusters: [cluster-b]} environment: \{ name: {bold cluster-b} \}`,
        chalk`{blueBright run-all-clusters: [cluster-c]} environment: \{ name: {bold cluster-c} \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    // Verify we don't have the bug where all jobs get the first job's environment name
    const buggyOutput = [
        chalk`{blueBright run-all-clusters: [cluster-b]} environment: \{ name: {bold cluster-a} \}`,
        chalk`{blueBright run-all-clusters: [cluster-c]} environment: \{ name: {bold cluster-a} \}`,
    ];
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining(buggyOutput));
});

/**
 * Direct test for issue #1725: Verify that each matrix job has its own independent
 * environment object after parsing.
 *
 * This test directly checks the Parser's job list to ensure environment names
 * are correctly expanded for each matrix job variant.
 *
 * Note: The actual bug manifested in production with Homebrew-installed v4.64.1
 * where all matrix jobs received the first job's environment URL. The fix ensures
 * the environment object is cloned (using spread operator) instead of assigned
 * by reference.
 */
test("parallel-matrix-environment - parser creates jobs with independent environment names", async () => {
    const writeStreams = new WriteStreamsMock();
    const argv = await Argv.build({
        cwd: "tests/test-cases/parallel-matrix-environment",
    }, writeStreams);

    const parser = await Parser.create(argv, writeStreams, 1, []);

    // Find the matrix jobs
    const matrixJobs = parser.jobs.filter(job => job.name.startsWith("run-all-clusters:"));

    // Should have 3 matrix jobs
    expect(matrixJobs.length).toBe(3);

    // The fix ensures each job has its OWN environment object (not shared)
    const env1 = matrixJobs[0].environment;
    const env2 = matrixJobs[1].environment;
    const env3 = matrixJobs[2].environment;

    // Environment objects must be independent (not the same reference)
    expect(env1).not.toBe(env2);
    expect(env2).not.toBe(env3);
    expect(env1).not.toBe(env3);

    // Each job should have its own environment name matching its CLUSTER variable
    const envNames = matrixJobs.map(job => job.environment?.name).sort();
    expect(envNames).toEqual(["cluster-a", "cluster-b", "cluster-c"]);

    // Verify each job's environment name matches its matrix variable
    for (const job of matrixJobs) {
        const clusterMatch = job.name.match(/\[([^\]]+)\]/);
        const expectedCluster = clusterMatch ? clusterMatch[1] : null;
        expect(job.environment?.name).toBe(expectedCluster);
    }
});
