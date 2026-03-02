import {configDefaults, defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        testTimeout: 60_000,
        exclude: [...configDefaults.exclude, "**/.gitlab-ci-local*/**"],
        pool: "threads",
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
