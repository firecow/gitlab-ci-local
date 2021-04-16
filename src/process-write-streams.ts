import {WriteStreams} from "./types/write-streams";

export class ProcessWriteStreams implements WriteStreams {
    stderr(txt: string): void {
        process.stderr.write(txt);
    }

    stdout(txt: string): void {
        process.stdout.write(txt);
    }

    flush(): void {
        // Process write streams flushes themselves.
    }

}
