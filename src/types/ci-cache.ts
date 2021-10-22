export interface CICache {
    policy: "pull" | "pull-push" | "push";
    key: string | { files: string[] };
    paths: string[];
}
