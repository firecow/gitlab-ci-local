export interface CICache {
    policy: "pull" | "push-pull" | "push";
    key: string | { files: string[] };
    paths: string[];
}
