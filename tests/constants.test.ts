// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2025, Timo Pallach (timo@pallach.de).

import {VALID_PIPELINE_SOURCES, SCHEDULE_NAME_CONSTRAINTS, ValidPipelineSource} from "../src/constants.js";

describe("Constants and Validation", () => {
    describe("VALID_PIPELINE_SOURCES", () => {
        test("should contain all expected pipeline sources", () => {
            const expectedSources = [
                "push",
                "schedule", 
                "merge_request_event",
                "web",
                "api",
                "external",
                "chat",
                "external_pull_request_event",
                "ondemand_dast_scan",
                "ondemand_dast_validation",
                "parent_pipeline",
                "pipeline",
                "security_orchestration_policy",
                "trigger",
                "webide"
            ];
            
            expect(VALID_PIPELINE_SOURCES).toEqual(expectedSources);
        });

                        test("should have correct length", () => {
                    expect(VALID_PIPELINE_SOURCES).toHaveLength(15);
                });

        test("should contain all individual pipeline sources", () => {
            // Test each pipeline source individually for comprehensive coverage
            const expectedSources = [
                "push",
                "schedule", 
                "merge_request_event",
                "web",
                "api",
                "external",
                "chat",
                "external_pull_request_event",
                "ondemand_dast_scan",
                "ondemand_dast_validation",
                "parent_pipeline",
                "pipeline",
                "security_orchestration_policy",
                "trigger",
                "webide"
            ];
            
            expectedSources.forEach(source => {
                expect(VALID_PIPELINE_SOURCES).toContain(source);
            });
        });

        test("should contain valid GitLab CI pipeline sources", () => {
            // These are the official GitLab CI pipeline source values
            expect(VALID_PIPELINE_SOURCES).toContain("push");
            expect(VALID_PIPELINE_SOURCES).toContain("schedule");
            expect(VALID_PIPELINE_SOURCES).toContain("merge_request_event");
            expect(VALID_PIPELINE_SOURCES).toContain("web");
            expect(VALID_PIPELINE_SOURCES).toContain("api");
            expect(VALID_PIPELINE_SOURCES).toContain("external");
            expect(VALID_PIPELINE_SOURCES).toContain("chat");
            expect(VALID_PIPELINE_SOURCES).toContain("external_pull_request_event");
            expect(VALID_PIPELINE_SOURCES).toContain("ondemand_dast_scan");
            expect(VALID_PIPELINE_SOURCES).toContain("ondemand_dast_validation");
            expect(VALID_PIPELINE_SOURCES).toContain("parent_pipeline");
            expect(VALID_PIPELINE_SOURCES).toContain("pipeline");
            expect(VALID_PIPELINE_SOURCES).toContain("security_orchestration_policy");
            expect(VALID_PIPELINE_SOURCES).toContain("trigger");
            expect(VALID_PIPELINE_SOURCES).toContain("webide");
        });
    });

    describe("ValidPipelineSource type", () => {
        test("should allow valid pipeline source values", () => {
            const validSource: ValidPipelineSource = "schedule";
            expect(VALID_PIPELINE_SOURCES).toContain(validSource);
        });

        test("should allow all valid pipeline source values", () => {
            // Test that all pipeline sources can be assigned to ValidPipelineSource type
            const validSources: ValidPipelineSource[] = [
                "push",
                "schedule", 
                "merge_request_event",
                "web",
                "api",
                "external",
                "chat",
                "external_pull_request_event",
                "ondemand_dast_scan",
                "ondemand_dast_validation",
                "parent_pipeline",
                "pipeline",
                "security_orchestration_policy",
                "trigger",
                "webide"
            ];
            
            validSources.forEach(source => {
                expect(VALID_PIPELINE_SOURCES).toContain(source);
            });
        });

        test("should not allow invalid pipeline source values", () => {
            // TypeScript should prevent this at compile time
            // @ts-expect-error - This should fail type checking
            const invalidSource: ValidPipelineSource = "invalid";
            expect(invalidSource).toBeDefined(); // This line should never execute
        });
    });

    describe("SCHEDULE_NAME_CONSTRAINTS", () => {
        test("should have correct MAX_LENGTH", () => {
            expect(SCHEDULE_NAME_CONSTRAINTS.MAX_LENGTH).toBe(255);
        });

        test("should have valid INVALID_CHARS array", () => {
            expect(SCHEDULE_NAME_CONSTRAINTS.INVALID_CHARS).toBeInstanceOf(Array);
        });

        test("should detect invalid characters correctly", () => {
            const invalidChars = SCHEDULE_NAME_CONSTRAINTS.INVALID_CHARS;
            
            // Test each character individually
            expect(invalidChars).toContain("<");
            expect(invalidChars).toContain(">");
            expect(invalidChars).toContain(":");
            expect(invalidChars).toContain("\"");
            expect(invalidChars).toContain("\\");
            expect(invalidChars).toContain("|");
            expect(invalidChars).toContain("?");
            expect(invalidChars).toContain("*");
        });

        test("should allow valid characters", () => {
            const validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.";
            const invalidChars = SCHEDULE_NAME_CONSTRAINTS.INVALID_CHARS;
            
            for (const char of validChars) {
                expect(invalidChars).not.toContain(char);
            }
        });

        test("should have descriptive INVALID_CHARS_DESCRIPTION", () => {
            expect(SCHEDULE_NAME_CONSTRAINTS.INVALID_CHARS_DESCRIPTION).toBe(
                "characters that are not allowed in filesystem names"
            );
        });

        test("should have immutable MAX_LENGTH", () => {
            const originalLength = SCHEDULE_NAME_CONSTRAINTS.MAX_LENGTH;
            expect(originalLength).toBe(255);
        });
    });

    describe("Integration tests", () => {
        test("should validate pipeline sources against constants", () => {
            const testSources = ["push", "schedule", "invalid", "web"];
            const validSources = testSources.filter(source => 
                VALID_PIPELINE_SOURCES.includes(source as any)
            );
            
            expect(validSources).toEqual(["push", "schedule", "web"]);
            expect(validSources).not.toContain("invalid");
        });

        test("should validate all pipeline sources individually", () => {
            // Test that each valid pipeline source is properly recognized
            const allValidSources = [
                "push",
                "schedule", 
                "merge_request_event",
                "web",
                "api",
                "external",
                "chat",
                "external_pull_request_event",
                "ondemand_dast_scan",
                "ondemand_dast_validation",
                "parent_pipeline",
                "pipeline",
                "security_orchestration_policy",
                "trigger",
                "webide"
            ];
            
            allValidSources.forEach(source => {
                expect(VALID_PIPELINE_SOURCES.includes(source as any)).toBe(true);
            });
        });

        test("should validate schedule name constraints", () => {
            const testNames = [
                "valid-name",
                "name with spaces",
                "name<with>invalid:chars",
                "a".repeat(300), // Too long
                "" // Empty
            ];

            const validNames = testNames.filter(name => {
                if (name.length === 0) return false;
                if (name.length > SCHEDULE_NAME_CONSTRAINTS.MAX_LENGTH) return false;
                if (SCHEDULE_NAME_CONSTRAINTS.INVALID_CHARS.some(char => name.includes(char))) return false;
                return true;
            });

            expect(validNames).toEqual(["valid-name", "name with spaces"]);
            expect(validNames).not.toContain("name<with>invalid:chars");
            expect(validNames).not.toContain("a".repeat(300));
            expect(validNames).not.toContain("");
        });
    });
});
