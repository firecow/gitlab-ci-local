import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {Job} from "../../../src/job.js";
import path from "path";
import fs from "fs-extra";

const jest = import.meta.jest;
let jobIdSpy: jest.SpyInstance;
let dateSpy: jest.SpyInstance;

const mockJobId = 123;
const mockDate = "2020-01-05T00:00:00Z";

const envVars: {[key: string]: string} = {
    CI: "true",
    CI_API_V4_URL: "https://gitlab.com/api/v4",
    CI_COMMIT_BRANCH: "master",
    CI_COMMIT_DESCRIPTION: "More commit text",
    CI_COMMIT_MESSAGE: "Commit Title",
    CI_COMMIT_REF_NAME: "master",
    CI_COMMIT_REF_PROTECTED: "false",
    CI_COMMIT_REF_SLUG: "master",
    CI_COMMIT_SHA: "02618988a1864b3d06cfee3bd79f8baa2dd21407",
    CI_COMMIT_SHORT_SHA: "02618988",
    CI_COMMIT_TIMESTAMP: mockDate,
    CI_COMMIT_TITLE: "Commit Title",
    CI_DEFAULT_BRANCH: "main",
    CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX: "gitlab.com:443/GCL/dependency_proxy/containers",
    CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX: "gitlab.com:443/GCL/dependency_proxy/containers",
    CI_DEPENDENCY_PROXY_SERVER: "gitlab.com:443",
    CI_ENVIRONMENT_ACTION: "",
    CI_ENVIRONMENT_NAME: "",
    CI_ENVIRONMENT_SLUG: "",
    CI_ENVIRONMENT_TIER: "",
    CI_ENVIRONMENT_URL: "",
    CI_JOB_ID: `${mockJobId}`,
    CI_JOB_NAME: "test-job",
    CI_JOB_NAME_SLUG: "test-job",
    CI_JOB_STAGE: "test",
    CI_JOB_STARTED_AT: mockDate,
    CI_JOB_STATUS: "running",
    CI_JOB_URL: `https://gitlab.com/GCL/predefined-variables/-/jobs/${mockJobId}`,
    CI_NODE_TOTAL: "1",
    CI_PIPELINE_CREATED_AT: mockDate,
    CI_PIPELINE_ID: "1000",
    CI_PIPELINE_IID: "0",
    CI_PIPELINE_SOURCE: "push",
    CI_PIPELINE_URL: "https://gitlab.com/GCL/predefined-variables/pipelines/0",
    CI_PROJECT_DIR: "/gcl-builds",
    CI_PROJECT_ID: "1217",
    CI_PROJECT_NAME: "predefined-variables",
    CI_PROJECT_NAMESPACE: "GCL",
    CI_PROJECT_PATH: "GCL/predefined-variables",
    CI_PROJECT_PATH_SLUG: "gcl-predefined-variables",
    CI_PROJECT_ROOT_NAMESPACE: "GCL",
    CI_PROJECT_TITLE: "predefinedVariables",
    CI_PROJECT_URL: "https://gitlab.com/GCL/predefined-variables",
    CI_PROJECT_VISIBILITY: "internal",
    CI_REGISTRY: "local-registry.gitlab.com",
    CI_REGISTRY_IMAGE: "local-registry.gitlab.com/gcl/predefined-variables",
    CI_SERVER_FQDN: "gitlab.com",
    CI_SERVER_HOST: "gitlab.com",
    CI_SERVER_PORT: "443",
    CI_SERVER_PROTOCOL: "https",
    CI_SERVER_SHELL_SSH_PORT: "22",
    CI_SERVER_URL: "https://gitlab.com",
    CI_TEMPLATE_REGISTRY_HOST: "registry.gitlab.com",
    FF_DISABLE_UMASK_FOR_DOCKER_EXECUTOR: "false",
    GITLAB_CI: "false",
    GITLAB_USER_EMAIL: "test@test.com",
    GITLAB_USER_ID: "990",
    GITLAB_USER_LOGIN: "test",
    GITLAB_USER_NAME: "Testersen",
    OLDPWD: "/gcl-builds",
    PWD: "/gcl-builds",
};


const cwd = "tests/test-cases/predefined-variables";
const fileVariable = path.join(cwd, ".gitlab-ci-local-variables.yml");

beforeAll(() => {
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:GCL/predefined-variables.git"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
    jobIdSpy = jest.spyOn(
        Job.prototype as any,
        "generateJobId"
    );
    jobIdSpy.mockReturnValue(mockJobId);

    const _mockDate = new Date(mockDate);
    dateSpy = jest.spyOn(global, "Date").mockImplementation(() => _mockDate);
});

describe("predefined-variables", () => {
    beforeEach(() => {
        fs.createFileSync(fileVariable);
    });
    afterEach(() => {
        fs.removeSync(fileVariable);
        jest.clearAllMocks();
    });

    test("normal", async () => {
        const writeStreams = new WriteStreamsMock();

        await handler({
            cwd: cwd,
            job: ["test-job"],
            shellIsolation: true,
            noColor: true,
        }, writeStreams);

        let expected = "";
        Object.keys(envVars).forEach(key => {
            expected += `test-job > ${key}=${envVars[key]}\n`;
        });

        const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("test-job > ")).join("\n");
        expect(filteredStdout).toEqual(expected.trim());
        expect(jobIdSpy).toHaveBeenCalledTimes(2);
        expect(dateSpy).toHaveBeenCalledTimes(3);
    });

    test("custom ports (via variable-file)", async () => {
        const writeStreams = new WriteStreamsMock();
        fs.writeFileSync(fileVariable, `
CI_SERVER_PORT: 8443
CI_SERVER_SHELL_SSH_PORT: 8022
`);

        await handler({
            cwd: cwd,
            job: ["test-job"],
            noColor: true,
        }, writeStreams);

        envVars["CI_API_V4_URL"] = "https://gitlab.com:8443/api/v4";
        envVars["CI_JOB_URL"] = `https://gitlab.com:8443/GCL/predefined-variables/-/jobs/${mockJobId}`;
        envVars["CI_PIPELINE_URL"] = "https://gitlab.com:8443/GCL/predefined-variables/pipelines/0";
        envVars["CI_PROJECT_URL"] = "https://gitlab.com:8443/GCL/predefined-variables";
        envVars["CI_SERVER_FQDN"] = "gitlab.com:8443";
        envVars["CI_SERVER_PORT"] = "8443";
        envVars["CI_SERVER_SHELL_SSH_PORT"] = "8022";
        envVars["CI_SERVER_URL"] = "https://gitlab.com:8443";

        envVars["CI_DEPENDENCY_PROXY_SERVER"] = "gitlab.com:8443";
        envVars["CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX"] = "gitlab.com:8443/GCL/dependency_proxy/containers";
        envVars["CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX"] = "gitlab.com:8443/GCL/dependency_proxy/containers";

        let expected = "";
        Object.keys(envVars).forEach(key => {
            expected += `test-job > ${key}=${envVars[key]}\n`;
        });
        const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("test-job > ")).join("\n");
        expect(filteredStdout).toEqual(expected.trim());
        expect(jobIdSpy).toHaveBeenCalledTimes(2);
        expect(dateSpy).toHaveBeenCalledTimes(3);
    });

    test("custom ports (via --variable)", async () => {
        const writeStreams = new WriteStreamsMock();

        fs.writeFileSync(fileVariable, `
CI_SERVER_PORT: 8443
CI_SERVER_SHELL_SSH_PORT: 8022
`);
        await handler({
            cwd: cwd,
            job: ["test-job"],
            variable: [
                "CI_SERVER_PORT=9443",
                "CI_SERVER_SHELL_SSH_PORT=9022",
            ],
            noColor: true,
        }, writeStreams);

        envVars["CI_API_V4_URL"] = "https://gitlab.com:9443/api/v4";
        envVars["CI_JOB_URL"] = `https://gitlab.com:9443/GCL/predefined-variables/-/jobs/${mockJobId}`;
        envVars["CI_PIPELINE_URL"] = "https://gitlab.com:9443/GCL/predefined-variables/pipelines/0";
        envVars["CI_PROJECT_URL"] = "https://gitlab.com:9443/GCL/predefined-variables";
        envVars["CI_SERVER_FQDN"] = "gitlab.com:9443";
        envVars["CI_SERVER_PORT"] = "9443";
        envVars["CI_SERVER_SHELL_SSH_PORT"] = "9022";
        envVars["CI_SERVER_URL"] = "https://gitlab.com:9443";

        envVars["CI_DEPENDENCY_PROXY_SERVER"] = "gitlab.com:9443";
        envVars["CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX"] = "gitlab.com:9443/GCL/dependency_proxy/containers";
        envVars["CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX"] = "gitlab.com:9443/GCL/dependency_proxy/containers";

        let expected = "";
        Object.keys(envVars).forEach(key => {
            expected += `test-job > ${key}=${envVars[key]}\n`;
        });

        const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("test-job > ")).join("\n");
        expect(filteredStdout).toEqual(expected.trim());
        expect(jobIdSpy).toHaveBeenCalledTimes(2);
        expect(dateSpy).toHaveBeenCalledTimes(3);
    });
});

test("predefined-variables <shell-isolation> --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/predefined-variables",
        job: ["shell-isolation"],
        shellIsolation: true,
        shellExecutorNoImage: false,
    }, writeStreams);

    const expected = [
        chalk`{blueBright shell-isolation} {greenBright >} ${process.cwd()}/tests/test-cases/predefined-variables/.gitlab-ci-local/builds/shell-isolation`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
