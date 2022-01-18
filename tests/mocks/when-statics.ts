export class WhenStatics {

    public static mockGitVersion = {cmd: "git --version", returnValue: {stdout: "git version 2.25.1\n"}};
    public static mockGitConfigEmail = {cmd: "git config user.email", returnValue: {stdout: "test@test.com\n"}};
    public static mockGitConfigName = {cmd: "git config user.name", returnValue: {stdout: "Testersen\n"}};
    public static mockUID = {cmd: "id -u", returnValue: {stdout: "990\n"}};
    public static mockGitRemote = {
        cmd: "git remote -v",
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/test-project.git (fetch)\norigin\tgit@gitlab.com:gcl/test-project.git (push)\n"},
    };
    public static mockGitCommit = [
        {
            cmd: "git rev-parse --abbrev-ref HEAD",
            returnValue: {stdout: "master"},
        },
        {
            cmd: "git rev-parse HEAD",
            returnValue: {stdout: "02618988a1864b3d06cfee3bd79f8baa2dd21407"},
        },
        {
            cmd: "git rev-parse --short HEAD",
            returnValue: {stdout: "0261898"},
        },
    ];

    public static all = [
        WhenStatics.mockGitVersion,
        WhenStatics.mockGitConfigEmail,
        WhenStatics.mockGitConfigName,
        WhenStatics.mockUID,
        WhenStatics.mockGitRemote,
        ...WhenStatics.mockGitCommit,
    ];

}
