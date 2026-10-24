export function isObject (v: any) {
    return v != null && Object.getPrototypeOf(v) === Object.prototype;
}

export function deepMerge (target: any, ...sources: any[]) {
    for (const source of sources.filter(isObject)) {
        for (const [key, value] of Object.entries(source)) {
            if (key === "__proto__") continue;
            target[key] = isObject(value) && isObject(target[key]) ? deepMerge(target[key], value) : structuredClone(value);
        }
    }
    return target;
}
