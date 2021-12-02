import {Utils} from "./utils";

export class CacheEntry {
    public readonly policy: "pull" | "pull-push" | "push";
    public readonly key: string | { files: string[] };
    public readonly paths: string[];

    constructor(key: string | { files: string[] }, paths: string[], policy: "pull" | "pull-push" | "push") {
        this.key = key;
        this.policy = policy;
        this.paths = paths;
    }

    async getUniqueCacheName(cwd: string, env: { [key: string]: string }) {
        if (typeof this.key === "string" || this.key == null) {
            return Utils.expandText(this.key ?? "default");
        }
        return "md-" + await Utils.checksumFiles(this.key.files.map(f => {
            return `${cwd}/${Utils.expandText(f, env)}`;
        }));
    }

}
