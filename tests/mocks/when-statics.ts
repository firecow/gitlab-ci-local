export class WhenStatics {

    public static readonly mockGitConfigEmail = {
        cmdArgs: ["git", "config", "user.email"],
        returnValue: {stdout: "test@test.com\n"},
    };
    public static readonly mockGitConfigName = {
        cmdArgs: ["git", "config", "user.name"],
        returnValue: {stdout: "Testersen\n"},
    };
    public static readonly mockUID = {
        cmdArgs: ["id", "-u"],
        returnValue: {stdout: "990\n"},
    };
    public static readonly mockGitRemote = {
        cmdArgs: ["bash", "-c", "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/test-project.git"},
    };
    public static readonly mockGitDefaultBranch = {
        cmdArgs: ["git", "symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
        returnValue: {stdout: "origin/main"},
    };
    public static readonly mockGitBranchName = {
        cmdArgs: ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        returnValue: {stdout: "master"},
    };
    public static readonly mockGitCommitSha = {
        cmdArgs: ["git", "rev-parse", "HEAD"],
        returnValue: {stdout: "02618988a1864b3d06cfee3bd79f8baa2dd21407"},
    };
    public static readonly mockGitCommitShaShort = {
        cmdArgs: ["git", "rev-parse", "--short", "HEAD"],
        returnValue: {stdout: "0261898"},
    };

    public static readonly all = [
        WhenStatics.mockGitConfigEmail,
        WhenStatics.mockGitConfigName,
        WhenStatics.mockUID,
        WhenStatics.mockGitRemote,
        WhenStatics.mockGitDefaultBranch,
        WhenStatics.mockGitBranchName,
        WhenStatics.mockGitCommitSha,
        WhenStatics.mockGitCommitShaShort,
    ];

    public static readonly mockGitRemoteHttp = {
        cmdArgs: ["git", "remote", "-v"],
        returnValue: {
            stdout: `origin https://gitlab.com/gcl/test-project.git (fetch)
origin https://gitlab.com/gcl/test-project.git (push)`,
        },
    };
}
