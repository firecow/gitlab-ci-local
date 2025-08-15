// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2025, Timo Pallach (timo@pallach.de).

import {init} from "../src/predefined-variables.js";
import {VALID_PIPELINE_SOURCES} from "../src/constants.js";

describe("Pipeline Simulation - Basic Tests", () => {
    test("should have init function available", () => {
        expect(init).toBeDefined();
        expect(typeof init).toBe("function");
    });

    test("should support all valid pipeline sources", () => {
        VALID_PIPELINE_SOURCES.forEach(source => {
            expect(source).toBeDefined();
            expect(typeof source).toBe("string");
            expect(source.length).toBeGreaterThan(0);
        });
    });

        test("should have correct number of pipeline sources", () => {
            expect(VALID_PIPELINE_SOURCES).toHaveLength(15); // Updated to match official GitLab docs
        });

            test("should include essential pipeline sources", () => {
            expect(VALID_PIPELINE_SOURCES).toContain("push");
            expect(VALID_PIPELINE_SOURCES).toContain("schedule");
            expect(VALID_PIPELINE_SOURCES).toContain("merge_request_event");
            expect(VALID_PIPELINE_SOURCES).toContain("web");
            expect(VALID_PIPELINE_SOURCES).toContain("api");
            expect(VALID_PIPELINE_SOURCES).toContain("external");
            expect(VALID_PIPELINE_SOURCES).toContain("chat");
        });
});
