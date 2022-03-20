import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "-v"],
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/custom-home.git (fetch)\norigin\tgit@gitlab.com:gcl/custom-home.git (push)\n"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
});

test("custom-home <test-staging>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: ["test-staging"],
        home: "tests/test-cases/custom-home/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-staging             } {greenBright >} group-global-var-override-value`,
        chalk`{blueBright test-staging             } {greenBright >} staging-project-group-var-override-value`,
        chalk`{blueBright test-staging             } {greenBright >} project-var-value`,
        chalk`{blueBright test-staging             } {greenBright >} ~/dir/`,
        // chalk`{blueBright test-staging             } {greenBright >} Im content of a file variable`,
        // chalk`{blueBright test-staging             } {greenBright >} "This is crazy"`,
        // chalk`{blueBright test-staging             } {greenBright >} \{ "private_key": "-----BEGIN PRIVATE KEY-----\\n" \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("custom-home <test-production>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: ["test-production"],
        home: "tests/test-cases/custom-home/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-production          } {greenBright >} production-project-group-var-override-value`,
        chalk`{blueBright test-production          } {greenBright >} I'm the content of a file variable`,
        chalk`{blueBright test-production          } {greenBright >} I'm the 2nd line of file variable`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("custom-home <test-image>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: ["test-image"],
        home: "tests/test-cases/custom-home/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-image               } {greenBright >} Im content of a file variable`,
        chalk`{blueBright test-image               } {greenBright >} "This is crazy"`,
        chalk`{blueBright test-image               } {greenBright >} \{ "private_key": "-----BEGIN PRIVATE KEY-----\\n" \}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("custom-home <test-normalize-key>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: ["test-normalize-key"],
        home: "tests/test-cases/custom-home/.home-normalize-key",
    }, writeStreams);

    const expected = [
        chalk`{yellow WARNING: Interpreting 'gitlab.com:gcl/' as 'gitlab.com/gcl/'}`,
        chalk`{yellow WARNING: Interpreting 'gitlab.com:gcl/custom-home' as 'gitlab.com/gcl/custom-home'}`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expected));
});

test("custom-home <test-predefined-overwrite>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: ["test-predefined-overwrite"],
        home: "tests/test-cases/custom-home/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-predefined-overwrite} {greenBright >} schedule`,
        chalk`{blueBright test-predefined-overwrite} {greenBright >} 12345678`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
