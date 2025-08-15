// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2018 - 2025, Timo Pallach (timo@pallach.de).

/**
 * Valid GitLab CI pipeline sources
 * These are the official pipeline source values supported by GitLab
 */
export const VALID_PIPELINE_SOURCES = [
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
    "webide",
] as const;

/**
 * Type for valid pipeline sources
 */
export type ValidPipelineSource = typeof VALID_PIPELINE_SOURCES[number];

/**
 * Validation constants for schedule names
 */
export const SCHEDULE_NAME_CONSTRAINTS = {
    MAX_LENGTH: 255,
    INVALID_CHARS: ["<", ">", ":", "\"", "\\", "|", "?", "*"],
    INVALID_CHARS_DESCRIPTION: "characters that are not allowed in filesystem names",
} as const;
