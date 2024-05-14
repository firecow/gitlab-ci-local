export enum GitlabRunnerPreset {
    AMD_64_SMALL = "saas-linux-small-amd64",
    AMD_64_MEDIUM = "saas-linux-medium-amd64",
    AMD_64_LARGE = "saas-linux-large-amd64",
    AMD_64_XLARGE = "saas-linux-xlarge-amd64",
    AMD_64_2XLARGE = "saas-linux-2xlarge-amd64",
}

export const GitlabRunnerPresetValues: string[] = Object.values(GitlabRunnerPreset);

export const GitlabRunnerMemoryPresetValue: Record<string, number> = {
    [GitlabRunnerPreset.AMD_64_SMALL]: 8096,
    [GitlabRunnerPreset.AMD_64_MEDIUM]: 16384,
    [GitlabRunnerPreset.AMD_64_LARGE]: 32768,
    [GitlabRunnerPreset.AMD_64_XLARGE]: 65536,
    [GitlabRunnerPreset.AMD_64_2XLARGE]: 131072,
};

export const GitlabRunnerCPUsPresetValue: Record<string, number> = {
    [GitlabRunnerPreset.AMD_64_SMALL]: 2,
    [GitlabRunnerPreset.AMD_64_MEDIUM]: 4,
    [GitlabRunnerPreset.AMD_64_LARGE]: 8,
    [GitlabRunnerPreset.AMD_64_XLARGE]: 16,
    [GitlabRunnerPreset.AMD_64_2XLARGE]: 32,
};