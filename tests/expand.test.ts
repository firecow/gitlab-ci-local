import chalk from "chalk";
import * as DataExpander from "../src/data-expander";
import {Utils} from "../src/utils";
import assert from "assert";
import {AssertionError} from "assert";

test("GITLAB_USER_LOGIN positive", () => {
    const variables = {APP_ENV: "$GITLAB_USER_LOGIN", HOSTNAME: "${GITLAB_USER_LOGIN}-stage.domain.com"};
    const expanded = Utils.expandVariables(variables, {GITLAB_USER_LOGIN: "mjn"});
    expect(expanded).toEqual({APP_ENV: "mjn", HOSTNAME: "mjn-stage.domain.com"});
});

test("GITLAB_USER_LOGIN negative", () => {
    const variables = {APP_ENV: "$GITLAB_USER_LOGIN", HOSTNAME: "${GITLAB_USER_LOGIN}-stage.domain.com"};
    const expanded = Utils.expandVariables(variables, {NOT_GITLAB_USER_LOGIN: "mjn"});
    expect(expanded).toEqual({APP_ENV: "", HOSTNAME: "-stage.domain.com"});
});

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

test("Expand number", () => {
    const expanded = Utils.expandText(5, {});
    expect(expanded).toBe("5");
});

test("Expand null", () => {
    const expanded = Utils.expandText(null, {});
    expect(expanded).toBe("null");
});

test("extends invalid job", () => {
    try {
        DataExpander.jobExtends({
            "test-job": {extends: ["build-job"]},
        });
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright build-job} is extended from {blueBright test-job}, but is unspecified`);
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
