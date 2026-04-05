import {configDefaults, defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: "forks",
                    include: [
                        "tests/test-cases/argv-cwd/**/*.test.ts",
                        "tests/test-cases/completion/**/*.test.ts",
                    ],
                    pool: "forks",
                },
            },
            {
                extends: true,
                test: {
                    name: "threads",
                    include: ["tests/**/*.test.ts"],
                    exclude: [...configDefaults.exclude, "**/.gitlab-ci-local*/**", "tests/test-cases/argv-cwd/**/*.test.ts", "tests/test-cases/completion/**/*.test.ts"],
                    pool: "threads",
                },
            },
        ],
        globals: true,
        testTimeout: 60_000,
        exclude: [...configDefaults.exclude, "**/.gitlab-ci-local*/**"],
        maxConcurrency: 25,
        env: {
            FORCE_COLOR: "1",
            HOME: "/tmp/gcl-test-home",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            reportsDirectory: "./coverage",
        },
    },
});
