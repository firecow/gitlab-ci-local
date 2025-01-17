import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {Utils} from "../../../src/utils.js";
import {when} from "jest-when";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("include-component no component template file (protocol: https)", async () => {
    initSpawnSpy([WhenStatics.mockGitRemoteHttp]);

    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/include-component/no-component-template-file",
            preview: true,
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: any) {
        assert(e instanceof AssertionError, `Unexpected error thrown:\n ${e}`);
        expect(e.message).toBe("This GitLab CI configuration is invalid: component: `gitlab.com/components/go/potato@0.3.1`. One of the files [templates/potato.yml,templates/potato/template.yml,] must exist in `gitlab.com/components/go`");
    }
});

test.concurrent("include-component component (protocol: https)", async () => {
    initSpawnSpy([WhenStatics.mockGitRemoteHttp]);
    const remoteFileExistSpy = import.meta.jest.spyOn(Utils, "remoteFileExist");
    when(remoteFileExistSpy).calledWith(expect.anything(), "templates/full-pipeline.yml", "0.3.1", "gitlab.com", "components/go", "https", "443").mockResolvedValue(true);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-component/component",
        preview: true,
    }, writeStreams);


    const expected = `---
stages:
  - .pre
  - format-override
  - build-override
  - test-override
  - .post
format-latest:
  image:
    name: golang:latest
  stage: format-override
  script:
    - go fmt $(go list ./... | grep -v /vendor/)
    - go vet $(go list ./... | grep -v /vendor/)
build-latest:
  image:
    name: golang:latest
  stage: build-override
  script:
    - mkdir -p mybinaries
    - go build -o mybinaries ./...
  artifacts:
    paths:
      - mybinaries
test-latest:
  image:
    name: golang:latest
  stage: test-override
  script:
    - go test -race $(go list ./... | grep -v /vendor/)`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});

test.concurrent("include-component local component", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/include-component/component-local",
        preview: true,
    }, writeStreams);

    const expected = `---
stages:
  - .pre
  - my-stage
  - .post
component-job:
  script:
    - echo job 1
  stage: my-stage`;

    expect(writeStreams.stdoutLines[0]).toEqual(expected);
});
