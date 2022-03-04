export class WhenStatics {

    public static mockGitVersion = {
        cmdArgs: ["git", "--version"],
        returnValue: {stdout: "git version 2.25.1\n"},
    };
    public static mockGitConfigEmail = {
        cmdArgs: ["git", "config", "user.email"],
        returnValue: {stdout: "test@test.com\n"},
    };
    public static mockGitConfigName = {
        cmdArgs: ["git", "config", "user.name"],
        returnValue: {stdout: "Testersen\n"},
    };
    public static mockUID = {
        cmdArgs: ["id", "-u"],
        returnValue: {stdout: "990\n"},
    };
    public static mockGitRemote = {
        cmdArgs: ["git", "remote", "-v"],
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/test-project.git (fetch)\norigin\tgit@gitlab.com:gcl/test-project.git (push)\n"},
    };
    public static mockGitCommit = {
        cmdArgs: ["git", "log", "-1", "--pretty=format:'%h %H %D'"],
        returnValue: {stdout: "0261898 02618988a1864b3d06cfee3bd79f8baa2dd21407 HEAD -> master, origin/master"},
    };

    public static all = [
        WhenStatics.mockGitVersion,
        WhenStatics.mockGitConfigEmail,
        WhenStatics.mockGitConfigName,
        WhenStatics.mockUID,
        WhenStatics.mockGitRemote,
        WhenStatics.mockGitCommit,
    ];

}
