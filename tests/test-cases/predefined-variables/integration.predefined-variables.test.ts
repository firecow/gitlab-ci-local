import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {stripAnsi} from "../../utils.js";
import {Job} from "../../../src/job.js";
import path from "path";
import fs from "fs-extra";

const jest = import.meta.jest;
let jobIdSpy: jest.SpyInstance;
let dateSpy: jest.SpyInstance;

const mockJobId = 123;
const mockDate = "2020-01-05T00:00:00Z";

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
        }, writeStreams);

        const expected = `test-job $ env | sort | grep -Ev "^RUBY|^PATH|^GEM|^BUNDLE|^HOSTNAME|^HOME=|^LANG="
test-job > CI=true
test-job > CI_API_V4_URL=https://gitlab.com/api/v4
test-job > CI_COMMIT_BRANCH=master
test-job > CI_COMMIT_DESCRIPTION=More commit text
test-job > CI_COMMIT_MESSAGE=Commit Title
test-job > CI_COMMIT_REF_NAME=master
test-job > CI_COMMIT_REF_PROTECTED=false
test-job > CI_COMMIT_REF_SLUG=master
test-job > CI_COMMIT_SHA=02618988a1864b3d06cfee3bd79f8baa2dd21407
test-job > CI_COMMIT_SHORT_SHA=02618988
test-job > CI_COMMIT_TIMESTAMP=${mockDate}
test-job > CI_COMMIT_TITLE=Commit Title
test-job > CI_DEFAULT_BRANCH=main
test-job > CI_ENVIRONMENT_ACTION=
test-job > CI_ENVIRONMENT_NAME=
test-job > CI_ENVIRONMENT_SLUG=
test-job > CI_ENVIRONMENT_TIER=
test-job > CI_ENVIRONMENT_URL=
test-job > CI_JOB_ID=${mockJobId}
test-job > CI_JOB_NAME=test-job
test-job > CI_JOB_NAME_SLUG=test-job
test-job > CI_JOB_STAGE=test
test-job > CI_JOB_STARTED_AT=${mockDate}
test-job > CI_JOB_STATUS=running
test-job > CI_JOB_URL=https://gitlab.com/GCL/predefined-variables/-/jobs/${mockJobId}
test-job > CI_NODE_TOTAL=1
test-job > CI_PIPELINE_CREATED_AT=${mockDate}
test-job > CI_PIPELINE_ID=1000
test-job > CI_PIPELINE_IID=0
test-job > CI_PIPELINE_SOURCE=push
test-job > CI_PIPELINE_URL=https://gitlab.com/GCL/predefined-variables/pipelines/0
test-job > CI_PROJECT_DIR=/gcl-builds
test-job > CI_PROJECT_ID=1217
test-job > CI_PROJECT_NAME=predefined-variables
test-job > CI_PROJECT_NAMESPACE=GCL
test-job > CI_PROJECT_PATH=GCL/predefined-variables
test-job > CI_PROJECT_PATH_SLUG=gcl-predefined-variables
test-job > CI_PROJECT_ROOT_NAMESPACE=GCL
test-job > CI_PROJECT_TITLE=predefinedVariables
test-job > CI_PROJECT_URL=https://gitlab.com/GCL/predefined-variables
test-job > CI_PROJECT_VISIBILITY=internal
test-job > CI_REGISTRY=local-registry.gitlab.com
test-job > CI_REGISTRY_IMAGE=local-registry.gitlab.com/gcl/predefined-variables
test-job > CI_SERVER_FQDN=gitlab.com
test-job > CI_SERVER_HOST=gitlab.com
test-job > CI_SERVER_PORT=443
test-job > CI_SERVER_PROTOCOL=https
test-job > CI_SERVER_SHELL_SSH_PORT=22
test-job > CI_SERVER_URL=https://gitlab.com
test-job > CI_TEMPLATE_REGISTRY_HOST=registry.gitlab.com
test-job > FF_DISABLE_UMASK_FOR_DOCKER_EXECUTOR=false
test-job > GITLAB_CI=false
test-job > GITLAB_USER_EMAIL=test@test.com
test-job > GITLAB_USER_ID=990
test-job > GITLAB_USER_LOGIN=test
test-job > GITLAB_USER_NAME=Testersen
test-job > More commit text
test-job > OLDPWD=/gcl-builds
test-job > PWD=/gcl-builds
test-job > SHLVL=2
test-job > _=/usr/bin/env`;

        expect(stripAnsi(writeStreams.stdoutLines.slice(2, -3).join("\n"))).toEqual(expected);
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
        }, writeStreams);

        const expected = `test-job $ env | sort | grep -Ev "^RUBY|^PATH|^GEM|^BUNDLE|^HOSTNAME|^HOME=|^LANG="
test-job > CI=true
test-job > CI_API_V4_URL=https://gitlab.com:8443/api/v4
test-job > CI_COMMIT_BRANCH=master
test-job > CI_COMMIT_DESCRIPTION=More commit text
test-job > CI_COMMIT_MESSAGE=Commit Title
test-job > CI_COMMIT_REF_NAME=master
test-job > CI_COMMIT_REF_PROTECTED=false
test-job > CI_COMMIT_REF_SLUG=master
test-job > CI_COMMIT_SHA=02618988a1864b3d06cfee3bd79f8baa2dd21407
test-job > CI_COMMIT_SHORT_SHA=02618988
test-job > CI_COMMIT_TIMESTAMP=${mockDate}
test-job > CI_COMMIT_TITLE=Commit Title
test-job > CI_DEFAULT_BRANCH=main
test-job > CI_ENVIRONMENT_ACTION=
test-job > CI_ENVIRONMENT_NAME=
test-job > CI_ENVIRONMENT_SLUG=
test-job > CI_ENVIRONMENT_TIER=
test-job > CI_ENVIRONMENT_URL=
test-job > CI_JOB_ID=${mockJobId}
test-job > CI_JOB_NAME=test-job
test-job > CI_JOB_NAME_SLUG=test-job
test-job > CI_JOB_STAGE=test
test-job > CI_JOB_STARTED_AT=${mockDate}
test-job > CI_JOB_STATUS=running
test-job > CI_JOB_URL=https://gitlab.com:8443/GCL/predefined-variables/-/jobs/${mockJobId}
test-job > CI_NODE_TOTAL=1
test-job > CI_PIPELINE_CREATED_AT=${mockDate}
test-job > CI_PIPELINE_ID=1000
test-job > CI_PIPELINE_IID=0
test-job > CI_PIPELINE_SOURCE=push
test-job > CI_PIPELINE_URL=https://gitlab.com:8443/GCL/predefined-variables/pipelines/0
test-job > CI_PROJECT_DIR=/gcl-builds
test-job > CI_PROJECT_ID=1217
test-job > CI_PROJECT_NAME=predefined-variables
test-job > CI_PROJECT_NAMESPACE=GCL
test-job > CI_PROJECT_PATH=GCL/predefined-variables
test-job > CI_PROJECT_PATH_SLUG=gcl-predefined-variables
test-job > CI_PROJECT_ROOT_NAMESPACE=GCL
test-job > CI_PROJECT_TITLE=predefinedVariables
test-job > CI_PROJECT_URL=https://gitlab.com:8443/GCL/predefined-variables
test-job > CI_PROJECT_VISIBILITY=internal
test-job > CI_REGISTRY=local-registry.gitlab.com
test-job > CI_REGISTRY_IMAGE=local-registry.gitlab.com/gcl/predefined-variables
test-job > CI_SERVER_FQDN=gitlab.com:8443
test-job > CI_SERVER_HOST=gitlab.com
test-job > CI_SERVER_PORT=8443
test-job > CI_SERVER_PROTOCOL=https
test-job > CI_SERVER_SHELL_SSH_PORT=8022
test-job > CI_SERVER_URL=https://gitlab.com:8443
test-job > CI_TEMPLATE_REGISTRY_HOST=registry.gitlab.com
test-job > FF_DISABLE_UMASK_FOR_DOCKER_EXECUTOR=false
test-job > GITLAB_CI=false
test-job > GITLAB_USER_EMAIL=test@test.com
test-job > GITLAB_USER_ID=990
test-job > GITLAB_USER_LOGIN=test
test-job > GITLAB_USER_NAME=Testersen
test-job > More commit text
test-job > OLDPWD=/gcl-builds
test-job > PWD=/gcl-builds
test-job > SHLVL=2
test-job > _=/usr/bin/env`;

        expect(stripAnsi(writeStreams.stdoutLines.slice(2, -3).join("\n"))).toEqual(expected);
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
        }, writeStreams);


        const expected = `test-job $ env | sort | grep -Ev "^RUBY|^PATH|^GEM|^BUNDLE|^HOSTNAME|^HOME=|^LANG="
test-job > CI=true
test-job > CI_API_V4_URL=https://gitlab.com:9443/api/v4
test-job > CI_COMMIT_BRANCH=master
test-job > CI_COMMIT_DESCRIPTION=More commit text
test-job > CI_COMMIT_MESSAGE=Commit Title
test-job > CI_COMMIT_REF_NAME=master
test-job > CI_COMMIT_REF_PROTECTED=false
test-job > CI_COMMIT_REF_SLUG=master
test-job > CI_COMMIT_SHA=02618988a1864b3d06cfee3bd79f8baa2dd21407
test-job > CI_COMMIT_SHORT_SHA=02618988
test-job > CI_COMMIT_TIMESTAMP=${mockDate}
test-job > CI_COMMIT_TITLE=Commit Title
test-job > CI_DEFAULT_BRANCH=main
test-job > CI_ENVIRONMENT_ACTION=
test-job > CI_ENVIRONMENT_NAME=
test-job > CI_ENVIRONMENT_SLUG=
test-job > CI_ENVIRONMENT_TIER=
test-job > CI_ENVIRONMENT_URL=
test-job > CI_JOB_ID=${mockJobId}
test-job > CI_JOB_NAME=test-job
test-job > CI_JOB_NAME_SLUG=test-job
test-job > CI_JOB_STAGE=test
test-job > CI_JOB_STARTED_AT=${mockDate}
test-job > CI_JOB_STATUS=running
test-job > CI_JOB_URL=https://gitlab.com:9443/GCL/predefined-variables/-/jobs/${mockJobId}
test-job > CI_NODE_TOTAL=1
test-job > CI_PIPELINE_CREATED_AT=${mockDate}
test-job > CI_PIPELINE_ID=1000
test-job > CI_PIPELINE_IID=0
test-job > CI_PIPELINE_SOURCE=push
test-job > CI_PIPELINE_URL=https://gitlab.com:9443/GCL/predefined-variables/pipelines/0
test-job > CI_PROJECT_DIR=/gcl-builds
test-job > CI_PROJECT_ID=1217
test-job > CI_PROJECT_NAME=predefined-variables
test-job > CI_PROJECT_NAMESPACE=GCL
test-job > CI_PROJECT_PATH=GCL/predefined-variables
test-job > CI_PROJECT_PATH_SLUG=gcl-predefined-variables
test-job > CI_PROJECT_ROOT_NAMESPACE=GCL
test-job > CI_PROJECT_TITLE=predefinedVariables
test-job > CI_PROJECT_URL=https://gitlab.com:9443/GCL/predefined-variables
test-job > CI_PROJECT_VISIBILITY=internal
test-job > CI_REGISTRY=local-registry.gitlab.com
test-job > CI_REGISTRY_IMAGE=local-registry.gitlab.com/gcl/predefined-variables
test-job > CI_SERVER_FQDN=gitlab.com:9443
test-job > CI_SERVER_HOST=gitlab.com
test-job > CI_SERVER_PORT=9443
test-job > CI_SERVER_PROTOCOL=https
test-job > CI_SERVER_SHELL_SSH_PORT=9022
test-job > CI_SERVER_URL=https://gitlab.com:9443
test-job > CI_TEMPLATE_REGISTRY_HOST=registry.gitlab.com
test-job > FF_DISABLE_UMASK_FOR_DOCKER_EXECUTOR=false
test-job > GITLAB_CI=false
test-job > GITLAB_USER_EMAIL=test@test.com
test-job > GITLAB_USER_ID=990
test-job > GITLAB_USER_LOGIN=test
test-job > GITLAB_USER_NAME=Testersen
test-job > More commit text
test-job > OLDPWD=/gcl-builds
test-job > PWD=/gcl-builds
test-job > SHLVL=2
test-job > _=/usr/bin/env`;

        expect(stripAnsi(writeStreams.stdoutLines.slice(2, -3).join("\n"))).toEqual(expected);
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
