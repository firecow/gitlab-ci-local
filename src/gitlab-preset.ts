export enum GitlabRunnerPreset {
    AMD_64_SMALL = "saas-linux-small-amd64",
    AMD_64_MEDIUM = "saas-linux-medium-amd64",
    AMD_64_LARGE = "saas-linux-large-amd64",
    AMD_64_XLARGE = "saas-linux-xlarge-amd64",
    AMD_64_2XLARGE = "saas-linux-2xlarge-amd64",
}

export const GitlabRunnerPresetValues: string[] = Object.values(GitlabRunnerPreset);

export const GitlabRunnerMemoryPresetValue: Record<string, number> = {
    [GitlabRunnerPreset.AMD_64_SMALL]: 8 * 1024,
    [GitlabRunnerPreset.AMD_64_MEDIUM]: 16 * 1024,
    [GitlabRunnerPreset.AMD_64_LARGE]: 32 * 1024,
    [GitlabRunnerPreset.AMD_64_XLARGE]: 64 * 1024,
    [GitlabRunnerPreset.AMD_64_2XLARGE]: 128 * 1024,
};

export const GitlabRunnerCPUsPresetValue: Record<string, number> = {
    [GitlabRunnerPreset.AMD_64_SMALL]: 2,
    [GitlabRunnerPreset.AMD_64_MEDIUM]: 4,
    [GitlabRunnerPreset.AMD_64_LARGE]: 8,
    [GitlabRunnerPreset.AMD_64_XLARGE]: 16,
    [GitlabRunnerPreset.AMD_64_2XLARGE]: 32,
};
