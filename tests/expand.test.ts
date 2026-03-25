import chalk from "chalk-template";
import * as DataExpander from "../src/data-expander.js";
import {Utils} from "../src/utils.js";
import assert from "assert";
import {AssertionError} from "assert";

test.concurrent("VAR w.o. brackets positive", () => {
    const expanded = Utils.expandText("$VAR", {VAR: "success"});
    expect(expanded).toBe("success");
});

test.concurrent("VAR w.o. brackets negative", () => {
    const expanded = Utils.expandText("$VAR", {UNSET_VAR: "success"});
    expect(expanded).toBe("");
});

test.concurrent("VAR w. brackets postive", () => {
    const expanded = Utils.expandText("${VAR}", {VAR: "success"});
    expect(expanded).toBe("success");
});

test.concurrent("VAR w. brackets negative", () => {
    const expanded = Utils.expandText("${VAR}", {UNSET_VAR: "success"});
    expect(expanded).toBe("");
});

test.concurrent("VAR w/ escapes", () => {
    const expanded = Utils.expandText("$$VAR $$$VAR $$$$VAR", {VAR: "success"});
    expect(expanded).toBe("$VAR $success $$VAR");
});

test.concurrent("Expand null", () => {
    const expanded = Utils.expandText(null, {});
    expect(expanded).toBe(null);
});

test.concurrent("extends invalid job", () => {
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

test.concurrent("extends infinite loop", () => {
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

test.concurrent("extends simple", () => {
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
