import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {vi} from "vitest";
import {GitData} from "../src/git-data.js";
import {ParserIncludes, remoteProjectUrl, resolveSemanticVersionRange} from "../src/parser-includes.js";
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

describe("remoteProjectUrl", () => {
    test("omits the default https port", () => {
        expect(remoteProjectUrl({schema: "https", host: "git.example.com", port: "443"}, "grp/proj"))
            .toEqual("https://git.example.com/grp/proj.git");
    });

    test("omits the default http port", () => {
        expect(remoteProjectUrl({schema: "http", host: "git.example.com", port: "80"}, "grp/proj"))
            .toEqual("http://git.example.com/grp/proj.git");
    });

    test("keeps a non-default port", () => {
        expect(remoteProjectUrl({schema: "https", host: "git.example.com", port: "8443"}, "grp/proj"))
            .toEqual("https://git.example.com:8443/grp/proj.git");
    });

    test("keeps port 80 when the schema is https", () => {
        expect(remoteProjectUrl({schema: "https", host: "git.example.com", port: "80"}, "grp/proj"))
            .toEqual("https://git.example.com:80/grp/proj.git");
    });
});

describe("ParserIncludes.downloadIncludeComponent", () => {
    const stateDir = ".gitlab-ci-local";
    let cwd: string;
    let gitCloneSpy: ReturnType<typeof vi.spyOn>;
    let invocations: {start: number; end: number}[];

    const makeOpts = () => ({
        cwd,
        stateDir,
        gitData: {remote: {schema: "https", host: "git.example.com", port: "443"}} as GitData,
        fetchIncludes: true,
        writeStreams: new WriteStreamsMock(),
    });

    beforeEach(async () => {
        cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gcl-includes-test-"));
        invocations = [];
        gitCloneSpy = vi.spyOn(ParserIncludes as any, "gitCloneSparseCheckout").mockImplementation(async () => {
            const start = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 50));
            invocations.push({start, end: Date.now()});
        });
    });

    afterEach(async () => {
        gitCloneSpy.mockRestore();
        await fs.rm(cwd, {recursive: true, force: true});
    });

    const target = (project: string, ref: string) =>
        `${stateDir}/includes/git.example.com/${project}/${ref}`;

    test("serializes concurrent downloads of the same project/ref", async () => {
        await Promise.all([
            ParserIncludes.downloadIncludeComponent(makeOpts(), "grp/proj", "v1.0.0", "component-a"),
            ParserIncludes.downloadIncludeComponent(makeOpts(), "grp/proj", "v1.0.0", "component-b"),
        ]);

        expect(invocations).toHaveLength(2);
        const [first, second] = [...invocations].sort((a, b) => a.start - b.start);
        expect(first.end).toBeLessThanOrEqual(second.start);
    });

    test("downloads different projects concurrently", async () => {
        await Promise.all([
            ParserIncludes.downloadIncludeComponent(makeOpts(), "grp/proj-a", "v1.0.0", "component"),
            ParserIncludes.downloadIncludeComponent(makeOpts(), "grp/proj-b", "v1.0.0", "component"),
        ]);

        expect(invocations).toHaveLength(2);
        const [first, second] = [...invocations].sort((a, b) => a.start - b.start);
        expect(first.start).toBeLessThan(second.end);
        expect(second.start).toBeLessThan(first.end);
    });

    test("creates the templates directory and cleans up the temporary directory", async () => {
        await ParserIncludes.downloadIncludeComponent(makeOpts(), "grp/proj", "v1.0.0", "component");

        const templatesDir = path.join(cwd, target("grp/proj", "v1.0.0"), "templates");
        expect((await fs.stat(templatesDir)).isDirectory()).toBe(true);
        // tmpDir is `${cwd}/${target}.tmp-*`, so leftovers would sit next to the ref dir
        const refParent = path.join(cwd, stateDir, "includes", "git.example.com", "grp/proj");
        expect((await fs.readdir(refParent)).filter((entry) => entry.startsWith("v1.0.0.tmp-"))).toEqual([]);
    });
});
