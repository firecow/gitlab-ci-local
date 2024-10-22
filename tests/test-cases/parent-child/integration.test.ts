import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const cwd = "tests/test-cases/parent-child";

test("by default inherit all global variables", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-1.yml",
        cwd: cwd,
        noColor: true,
    }, writeStreams);

    const expected = `	[parent] -> child $ env | sort | grep VAR
	[parent] -> child > GLOBAL_VAR=i am global var
	[parent] -> child > JOB_VAR=i am job var
	[parent] -> child > PARENT_JOB_VAR=i am parent job var`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[parent] -> child $") || f.startsWith("	[parent] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test("prevent global variables from being inherited", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-2.yml",
        cwd: cwd,
        noColor: true,
    }, writeStreams);

    const expected = `	[parent] -> child $ env | sort | grep VAR
	[parent] -> child > JOB_VAR=i am job var
	[parent] -> child > PARENT_JOB_VAR=i am parent job var`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[parent] -> child $") || f.startsWith("	[parent] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test("inherit selective global variable", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-4.yml",
        cwd: cwd,
        noColor: true,
    }, writeStreams);

    const expected = `	[parent] -> child $ env | sort | grep VAR
	[parent] -> child > GLOBAL_VAR=i am global var
	[parent] -> child > JOB_VAR=i have a higher precedence`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[parent] -> child $") || f.startsWith("	[parent] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test("dynamic pipeline", async () => {

    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-5.yml",
        cwd: cwd,
        noColor: true,
        concurrency: 1,
    }, writeStreams);

    const expected = `	[dynamic-pipeline] -> child $ echo i am generated
	[dynamic-pipeline] -> child > i am generated`;
    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("	[dynamic-pipeline] -> child $") || f.startsWith("	[dynamic-pipeline] -> child >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});


test("nested child pipeline", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-6.yml",
        cwd: cwd,
        noColor: true,
    }, writeStreams);

    const expected = `		[parent -> nested-child-1] -> nested-child-2 $ echo i am nested child 2
		[parent -> nested-child-1] -> nested-child-2 > i am nested child 2`;

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("		[parent -> nested-child-1] -> nested-child-2 >") || f.startsWith("		[parent -> nested-child-1] -> nested-child-2 $")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test("2 dynamic pipeline with concurrency set to 1", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        file: ".gitlab-ci-7.yml",
        cwd: cwd,
        noColor: true,
        concurrency: 1,
    }, writeStreams);

    const expected = `	[dynamic-pipeline-1] -> child $ echo i am generated
	[dynamic-pipeline-1] -> child > i am generated
	[dynamic-pipeline-2] -> child $ echo i am generated
	[dynamic-pipeline-2] -> child > i am generated`;

    const filteredStdout = writeStreams.stdoutLines.filter(f =>
        f.startsWith("	[dynamic-pipeline-1] -> child >")
            || f.startsWith("	[dynamic-pipeline-1] -> child $")
            || f.startsWith("	[dynamic-pipeline-2] -> child >")
            || f.startsWith("	[dynamic-pipeline-2] -> child $")
    ).join("\n");
    expect(filteredStdout).toEqual(expected);
});
