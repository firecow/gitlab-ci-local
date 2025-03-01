export class Mutex {

    private static readonly locks = new Set();

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

    static async exclusive (key: string, cb: () => Promise<void>) {
        await Mutex.waitForLock(key);
        Mutex.locks.add(key);
        await cb();
        Mutex.locks.delete(key);
    }

}
