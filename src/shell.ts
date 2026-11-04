import {execa, execaSync} from "execa";

export class Shell {
    static bashMulti (scripts: string[], cwd = process.cwd()): Promise<{stdout: string; stderr: string; exitCode?: number}> {
        return execa(scripts.join(" && \\"), {shell: "bash", cwd, env: Shell.bashEnv()});
    }

    static bash (shellScript: string, cwd = process.cwd()): Promise<{stdout: string; stderr: string; exitCode?: number}> {
        return execa(shellScript, {shell: "bash", cwd, env: Shell.bashEnv()});
    }

    private static bashEnv (): NodeJS.ProcessEnv {
        if (process.platform !== "win32") {
            return process.env;
        }
        return {
            ...process.env,
            MSYS_NO_PATHCONV: "1",
            MSYS2_ARG_CONV_EXCL: "*",
        };
    }

    static spawn (cmdArgs: string[], cwd = process.cwd()): Promise<{stdout: string; stderr: string}> {
        return execa(cmdArgs[0], cmdArgs.slice(1), {cwd});
    }

    static syncSpawn (cmdArgs: string[], cwd = process.cwd()): {stdout: string; stderr: string} {
        return execaSync(cmdArgs[0], cmdArgs.slice(1), {cwd});
    }
}

export function safeBashString (s: string) {
    return `'${s.replaceAll("'", "'\"'\"'")}'`;
}
