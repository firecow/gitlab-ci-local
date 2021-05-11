import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("project-variables <test-job>", async () => {
	const writeStreams = new MockWriteStreams();
	await handler({
		cwd: "tests/test-cases/project-variables",
		job: ["test-job"],
		home: "tests/test-cases/project-variables/.home",
	}, writeStreams);

	const expected = [
		chalk`{blueBright test-job} {greenBright >} project-var-value`,
		chalk`{blueBright test-job} {greenBright >} Im content of a file variable`,
	];
	expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
