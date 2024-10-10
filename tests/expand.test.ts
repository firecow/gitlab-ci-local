import chalk from "chalk";
import * as DataExpander from "../src/data-expander.js";
import {Utils} from "../src/utils.js";
import assert from "assert";
import {AssertionError} from "assert";

test("VAR w.o. brackets positive", () => {
    const expanded = Utils.expandText("$VAR", {VAR: "success"});
    expect(expanded).toBe("success");
});

test("VAR w.o. brackets negative", () => {
    const expanded = Utils.expandText("$VAR", {UNSET_VAR: "success"});
    expect(expanded).toBe("");
});

test("VAR w. brackets postive", () => {
    const expanded = Utils.expandText("${VAR}", {VAR: "success"});
    expect(expanded).toBe("success");
});

test("VAR w. brackets negative", () => {
    const expanded = Utils.expandText("${VAR}", {UNSET_VAR: "success"});
    expect(expanded).toBe("");
});

test("VAR w/ escapes", () => {
    const expanded = Utils.expandText("$$VAR $$$VAR $$$$VAR", {VAR: "success"});
    expect(expanded).toBe("$VAR $success $$VAR");
});

test("Expand null", () => {
    const expanded = Utils.expandText(null, {});
    expect(expanded).toBe(null);
});

test("extends invalid job", () => {
    try {
        DataExpander.jobExtends({
            "test-job": {extends: ["build-job"]},
        });
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright build-job} is unspecified, used by {blueBright test-job} extends`);
    }
});

test("extends infinite loop", () => {
    try {
        DataExpander.jobExtends({
            "build-job": {extends: ["test-job"]},
            "test-job": {extends: ["build-job"]},
        });
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright test-job}: circular dependency detected in \`extends\``);
    }
});

test("extends simple", () => {
    const gitlabData = {
        "test-job": {
            extends: ["build-job"],
        },
        "build-job": {
            script: ["echo \"Hello, world!\""],
        },
    };

    DataExpander.jobExtends(gitlabData);

    const expected = {
        "test-job": {
            script: ["echo \"Hello, world!\""],
        },
        "build-job": {
            script: ["echo \"Hello, world!\""],
        },
    };

    expect(gitlabData).toEqual(expected);
});
