import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylisticTs from "@stylistic/eslint-plugin-ts";

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        ignores: [
            "**/*.js",
            ".gitlab-ci-local",
        ],
    },
    {
        plugins: {
            "@stylistic/ts": stylisticTs,
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@stylistic/ts/semi": "error",
            "@stylistic/ts/quotes": "error",
            "@stylistic/ts/comma-dangle": [
                "error",
                "always-multiline",
            ],
            "@stylistic/ts/object-curly-spacing": "error",
            "@stylistic/ts/space-before-function-paren": "error",
            "@stylistic/ts/space-before-blocks": "error",
            "@stylistic/ts/space-infix-ops": "error",
            "@stylistic/ts/member-delimiter-style": "error",
            "@stylistic/ts/indent": [
                "error",
                4,
            ],
            "@stylistic/ts/type-annotation-spacing": [ "error" ],
            "@stylistic/ts/func-call-spacing": [
                "error",
            ],
            "@stylistic/ts/comma-spacing": [
                "error",
            ],
            "keyword-spacing": "error",
            "space-in-parens": "error",
            "no-trailing-spaces": "error",
            "no-multi-spaces": "error",
            "arrow-spacing": "error",
            "key-spacing": "error",
        },
    },
);
