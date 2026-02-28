import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        testTimeout: 60_000,
        include: ["tests/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/.gitlab-ci-local*/**"],
        env: {
            FORCE_COLOR: "1",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            reportsDirectory: "./coverage",
        },
    },
});
