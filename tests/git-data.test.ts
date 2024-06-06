import {GitData} from "../src/git-data";
import {WriteStreamsMock} from "../src/write-streams";
import {initSpawnSpy, initSpawnSpyReject} from "./mocks/utils.mock";


const tests = [
    {
        input: "ssh://git@gitlab.example.com:5555/myrepo/myproject.git",
        expected: {
            schema: "ssh",
            port: "5555",
            host: "gitlab.example.com",
            group: "myrepo",
            project: "myproject",
        },
    },
    {
        input: "ssh://git@gitlab.example.com/myrepo/myproject.git",
        expected: {
            schema: "ssh",
            port: "22",
            host: "gitlab.example.com",
            group: "myrepo",
            project: "myproject",
        },
    },
    {
        input: "git@github.com:firecow/gitlab-ci-local.git",
        expected: {
            schema: "git",
            port: "22",
            host: "github.com",
            group: "firecow",
            project: "gitlab-ci-local",
        },
    },
    {
        input: "git@github.com:firecow/gitlab-ci.local.git", // project can contain .
        expected: {
            schema: "git",
            port: "22",
            host: "github.com",
            group: "firecow",
            project: "gitlab-ci.local",
        },
    },
    {
        input: "git@github.com:firecow/gitlab-ci-local", // does not need to end with .git
        expected: {
            schema: "git",
            port: "22",
            host: "github.com",
            group: "firecow",
            project: "gitlab-ci-local",
        },
    },
    {
        input: "https://oauth2:glpat-qwerty12345@somegitlab.com/vendor/package.git",
        expected: {
            schema: "https",
            port: "443",
            host: "somegitlab.com",
            group: "vendor",
            project: "package",
        },
    },
    {
        input: "https://oauth2:glpat-qwerty12345@somegitlab.com:8080/vendor/package.git",
        expected: {
            schema: "https",
            port: "8080",
            host: "somegitlab.com",
            group: "vendor",
            project: "package",
        },
    },
    {
        input: "https://example.com:8443/1/2/3package.git",
        expected: {
            schema: "https",
            port: "8443",
            host: "example.com",
            group: "1/2",
            project: "3package",
        },
    },
    {
        input: "https://example.com:1/vendor/package.git",
        expected: {
            schema: "https",
            port: "1",
            host: "example.com",
            group: "vendor",
            project: "package",
        },
    },
    {
        input: "http://example.com/vendor/package.git",
        expected: {
            schema: "http",
            port: "80",
            host: "example.com",
            group: "vendor",
            project: "package",
        },
    },
];


describe("initRemoteData", () => {
    tests.forEach((t) => {
        test(t.input, async () => {
            const writeStreams = new WriteStreamsMock();

            initSpawnSpyReject([{
                cmdArgs: "git remote get-url gcl-origin".split(" "),
                rejection: {
                    exitCode: 2,
                    stderr: "error: No such remote 'gcl-origin'",
                },
            }]);
            initSpawnSpy([{
                cmdArgs: "git remote get-url origin".split(" "),
                returnValue: {stdout: t.input},
            }]);

            const {remote} = await GitData.init("tests", writeStreams);

            expect(remote).toStrictEqual(t.expected);
        });
    });
});
