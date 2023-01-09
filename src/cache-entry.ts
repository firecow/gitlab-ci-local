import {Utils} from "./utils";

export class CacheEntry {
    public readonly policy: "pull" | "pull-push" | "push";
    public readonly key: string | {files: string[]};
    public readonly paths: string[];
    public readonly when: "on_success" | "on_failure" | "always";

    constructor (key: string | {files: string[]}, paths: string[], policy: "pull" | "pull-push" | "push", when: "on_success" | "on_failure" | "always") {
        this.key = key;
        this.policy = policy;
        this.paths = paths;
        this.when = when;
    }

    async getUniqueCacheName (cwd: string, env: {[key: string]: string}) {
        if (typeof this.key === "string" || this.key == null) {
            return Utils.expandText(this.key ?? "default", env);
        }
        return "md-" + await Utils.checksumFiles(this.key.files.map(f => {
            return `${cwd}/${Utils.expandText(f, env)}`;
        }));
    }

}
