import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

describe("validate-dependency-chain", () => {
    test("should pass when all dependencies are valid", async () => {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/validate-dependency-chain",
            validateDependencyChain: true,
            variable: ["RUN_ALL=true"],
        }, writeStreams);

        const output = writeStreams.stdoutLines.join("\n");
        expect(output).toContain(chalk`{green ✓ All job dependencies are valid}`);

        // Check that there are no validation errors in stderr (only info messages)
        const validationErrors = writeStreams.stderrLines.filter(line =>
            line.includes("Dependency chain validation will fail with event"),
        );
        expect(validationErrors.length).toBe(0);
    });

    test("should fail when dependency chain is broken due to a non-existent job", async () => {
        const writeStreams = new WriteStreamsMock();

        await expect(handler({
            cwd: "tests/test-cases/validate-dependency-chain",
            validateDependencyChain: true,
            variable: ["RUN_SINGLE=alpine-root"],
        }, writeStreams)).rejects.toThrow(chalk`{blueBright kaniko-root} is when:never, but its needed by {blueBright alpine-root}`);
    });

    test("should fail when dependency chain is broken due to a job that never runs", async () => {
        const writeStreams = new WriteStreamsMock();

        await expect(handler({
            cwd: "tests/test-cases/validate-dependency-chain",
            validateDependencyChain: true,
            variable: ["RUN_SINGLE=alpine-guest"],
        }, writeStreams)).rejects.toThrow(chalk`{blueBright alpine-root} is when:never, but its needed by {blueBright alpine-guest}`);
    });

    test("should fail when dependencies keyword references missing artifact jobs", async () => {
        const writeStreams = new WriteStreamsMock();

        await expect(handler({
            cwd: "tests/test-cases/validate-dependency-chain",
            validateDependencyChain: true,
            variable: ["TEST_DEPENDENCIES=true"],
        }, writeStreams)).rejects.toThrow(chalk`{blueBright build-job-2} is when:never, but its depended on by {blueBright broken-dependencies-job}`);
    });
});