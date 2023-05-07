type MutexExclusiveCallback = () => Promise<void>;

export class Mutex {

    private static locks = new Set();

    private static async waitForLock (key: string) {
        return new Promise<void>((resolve) => {
            const intervalKey = setInterval(() => {
                if (!Mutex.locks.has(key)) {
                    clearInterval(intervalKey);
                    return resolve();
                }
            }, 10);
        });
    }

    static async exclusive (key: string, cb: MutexExclusiveCallback) {
        await Mutex.waitForLock(key);
        Mutex.locks.add(key);
        await cb();
        Mutex.locks.delete(key);
    }

}
