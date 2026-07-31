import fs from "fs-extra";
import {vi} from "vitest";
import {ParserIncludes, resolveSemanticVersionRange} from "../src/parser-includes.js";
import {Utils} from "../src/utils.js";
import {WriteStreamsMock} from "../src/write-streams.js";

const tests = [
    {
        name: "`~latest` should return the latest release version",
        range: "~latest",
        expect: "2.1.0",
    },
    {
        name: "`1` should return the latest minor version",
        range: "1",
        expect: "1.2.1",
    },
    {
        name: "`1.1` should return the latest patch version",
        range: "1.1",
        expect: "1.1.1",
    },
    {
        name: "should return undefined if none of the version satisfies the range",
        range: "9999999",
        expect: undefined,
    },
];

const gitTags = [
    "1.0.0",
    "1.1.0",
    "non-semver-compliant-tag",
    "2.0.0",
    "1.1.1",
    "1.2.0",
    "1.2.1",
    "2.1.0",
    "2.0.1",
    "2.2.0-rc",
    "2.3.0-pre",
];

describe("resolveSemanticVersionRange", () => {
    tests.forEach((t) => {
        test(t.name, async () => {
            const result = resolveSemanticVersionRange(t.range, gitTags);
            expect(result).toEqual(t.expect);
        });
    });
});

describe("downloadIncludeComponent", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("quotes generated bash paths with spaces", async () => {
        const cwd = "C:\\Users\\My Name\\IdeaProjects\\project";
        const stateDir = ".gitlab-ci-local";
        const target = `${stateDir}/includes/gitlab.com/arc/ci-cd-components/1.3.0`;
        const tmpDir = `${cwd}/${target}.tmp-0.42`;
        const bashMultiSpy = vi.spyOn(Utils, "bashMulti").mockResolvedValue({stdout: "", stderr: "", exitCode: 0});

        vi.spyOn(Math, "random").mockReturnValue(0.42);
        vi.spyOn(fs, "pathExists").mockResolvedValue(undefined);
        vi.spyOn(fs, "mkdirp").mockResolvedValue(undefined);
        vi.spyOn(fs, "rm").mockResolvedValue(undefined);

        await ParserIncludes.downloadIncludeComponent({
            cwd,
            stateDir,
            fetchIncludes: false,
            writeStreams: new WriteStreamsMock(),
            gitData: {
                remote: {
                    schema: "https",
                    host: "gitlab.com",
                    port: "443",
                },
            },
        } as any, "arc/ci-cd-components", "1.3.0", "templates/foo");

        expect(bashMultiSpy).toHaveBeenCalledWith([
            `cd '${cwd}/${stateDir}'`,
            `git clone --branch '1.3.0' -n --depth=1 --filter=tree:0 https://gitlab.com:443/arc/ci-cd-components.git '${tmpDir}'`,
            `cd '${tmpDir}'`,
            "git sparse-checkout set --no-cone 'templates/foo.yml' 'templates/foo/template.yml'",
            "git checkout",
            `cd '${cwd}/${stateDir}'`,
            `mkdir -p '${tmpDir}/templates'`,
            `cp -r '${tmpDir}/templates' '${cwd}/${target}'`,
        ], cwd);
    });
});
