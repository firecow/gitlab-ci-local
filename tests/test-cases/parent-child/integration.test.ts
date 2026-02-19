import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const cwd = "tests/test-cases/parent-child";

test.concurrent("by default inherit all global variables", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-1.yml",
        cwd: cwd,
        noColor: true,
        stateDir: ".gitlab-ci-local-by-default-inherit-all-global-variables",
    }, writeStreams);

    const expected = `	[parent] -> child $ env | sort | grep VAR
	[parent] -> child > GLOBAL_VAR=i am global var
	[parent] -> child > JOB_VAR=i am job var
	[parent] -> child > PARENT_JOB_VAR=i am parent job var`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[parent] -> child $") || f.startsWith("	[parent] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test.concurrent("prevent global variables from being inherited", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-2.yml",
        cwd: cwd,
        noColor: true,
        stateDir: ".gitlab-ci-local-prevent-global-variables-from-being-inherited",
    }, writeStreams);

    const expected = `	[parent] -> child $ env | sort | grep VAR
	[parent] -> child > JOB_VAR=i am job var
	[parent] -> child > PARENT_JOB_VAR=i am parent job var`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[parent] -> child $") || f.startsWith("	[parent] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test.concurrent("inherit selective global variable", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-4.yml",
        cwd: cwd,
        noColor: true,
        stateDir: ".gitlab-ci-local-inherit-selective-global-variable",
    }, writeStreams);

    const expected = `	[parent] -> child $ env | sort | grep VAR
	[parent] -> child > GLOBAL_VAR=i am global var
	[parent] -> child > JOB_VAR=i have a higher precedence`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[parent] -> child $") || f.startsWith("	[parent] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test.concurrent("dynamic pipeline", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-5.yml",
        cwd: cwd,
        noColor: true,
        concurrency: 1,
        stateDir: ".gitlab-ci-local-dynamic-pipeline",
    }, writeStreams);

    const expected = `	[dynamic-pipeline] -> child $ echo i am generated
	[dynamic-pipeline] -> child > i am generated`;
    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[dynamic-pipeline] -> child $") || f.startsWith("	[dynamic-pipeline] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});


test.concurrent("nested child pipeline", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-6.yml",
        cwd: cwd,
        noColor: true,
        stateDir: ".gitlab-ci-local-nested-child-pipeline",
    }, writeStreams);

    const expected = `		[parent -> nested-child-1] -> nested-child-2 $ echo i am nested child 2
		[parent -> nested-child-1] -> nested-child-2 > i am nested child 2`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("		[parent -> nested-child-1] -> nested-child-2 >") || f.startsWith("		[parent -> nested-child-1] -> nested-child-2 $")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test.concurrent("2 dynamic pipeline with concurrency set to 1", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-7.yml",
        cwd: cwd,
        noColor: true,
        concurrency: 1,
        stateDir: ".gitlab-ci-local-2-dynamic-pipeline-with-concurrency-set-to-1",
    }, writeStreams);

    const expected = `	[dynamic-pipeline-1] -> child $ echo i am generated
	[dynamic-pipeline-1] -> child > i am generated
	[dynamic-pipeline-2] -> child $ echo i am generated
	[dynamic-pipeline-2] -> child > i am generated`;

    const filteredStdout = writeStreams.stdoutLines.filter(f =>
        f.startsWith("	[dynamic-pipeline-1] -> child >") ||
            f.startsWith("	[dynamic-pipeline-1] -> child $") ||
            f.startsWith("	[dynamic-pipeline-2] -> child >") ||
            f.startsWith("	[dynamic-pipeline-2] -> child $"),
    ).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test.concurrent("trigger:include:local should support variable substitution", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-8.yml",
        noColor: true,
        stateDir: ".gitlab-ci-local-trigger-include-local-should-support-variable-substitution",
    }, writeStreams);

    const expected = `	[trigger] -> job $ echo yay variable substitution works
	[trigger] -> job > yay variable substitution works`;

    const filteredStdout = writeStreams.stdoutLines.filter(f =>
        f.startsWith("	[trigger] -> job >") ||
            f.startsWith("	[trigger] -> job $"),
    ).join("\n");
    expect(filteredStdout).toEqual(expected);
});
