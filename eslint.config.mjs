import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        ignores: [
            "**/*.js",
            "**/*.cjs",
            ".gitlab-ci-local",
        ],
    },
    {
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@stylistic/semi": "error",
            "@stylistic/quotes": "error",
            "@stylistic/comma-dangle": [
                "error",
                "always-multiline",
            ],
            "@stylistic/object-curly-spacing": "error",
            "@stylistic/space-before-function-paren": "error",
            "@stylistic/space-before-blocks": "error",
            "@stylistic/space-infix-ops": "error",
            "@stylistic/member-delimiter-style": "error",
            "@stylistic/indent": [
                "error",
                4,
            ],
            "@stylistic/operator-linebreak": ["error", "after"],
            "@stylistic/type-annotation-spacing": [ "error" ],
            "@stylistic/func-call-spacing": [
                "error",
            ],
            "@stylistic/comma-spacing": [
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
