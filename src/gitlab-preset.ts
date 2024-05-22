export enum GitlabRunnerPreset {
    SMALL = "saas-linux-small",
    MEDIUM = "saas-linux-medium",
    LARGE = "saas-linux-large",
    XLARGE = "saas-linux-xlarge",
    TWO_XLARGE = "saas-linux-2xlarge",
}

export const GitlabRunnerPresetValues: string[] = Object.values(GitlabRunnerPreset);

export const GitlabRunnerMemoryPresetValue: Record<string, number> = {
    [GitlabRunnerPreset.SMALL]: 8 * 1024,
    [GitlabRunnerPreset.MEDIUM]: 16 * 1024,
    [GitlabRunnerPreset.LARGE]: 32 * 1024,
    [GitlabRunnerPreset.XLARGE]: 64 * 1024,
    [GitlabRunnerPreset.TWO_XLARGE]: 128 * 1024,
};

export const GitlabRunnerCPUsPresetValue: Record<string, number> = {
    [GitlabRunnerPreset.SMALL]: 2,
    [GitlabRunnerPreset.MEDIUM]: 4,
    [GitlabRunnerPreset.LARGE]: 8,
    [GitlabRunnerPreset.XLARGE]: 16,
    [GitlabRunnerPreset.TWO_XLARGE]: 32,
};
