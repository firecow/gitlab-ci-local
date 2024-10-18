export interface WriteStreams {
    stdout: (txt: string) => void;
    memoStdout: (txt: string) => void;
    stderr: (txt: string) => void;
    flush: () => void;
}

abstract class AbstractWriteStreams implements WriteStreams {
    abstract stdout (txt: string): void;
    abstract stderr (txt: string): void;
    abstract flush (): void;

    memoStdout = (() => {
        const cache = new Map();
        return (message: string) => {
            if (cache.has(message)) return;
            cache.set(message, null);
            this.stdout(message);
        };
    })();
}

export class WriteStreamsProcess extends AbstractWriteStreams {
    stderr (txt: string): void {
        process.stderr.write(txt);
    }

    stdout (txt: string): void {
        process.stdout.write(txt);
    }

    flush (): void {
        // Process write streams flushes themselves.
    }
}

export class WriteStreamsMock extends AbstractWriteStreams {
    private currentStderr = "";
    private currentStdout = "";

    readonly stderrLines: string[] = [];
    readonly stdoutLines: string[] = [];

    stderr (txt: string): void {
        this.currentStderr += txt;
        if (txt.endsWith("\n")) {
            this.stderrLines.push(this.currentStderr.slice(0, -1));
            this.currentStderr = "";
        }
    }

    stdout (txt: string): void {
        this.currentStdout += txt;
        if (txt.endsWith("\n")) {
            this.stdoutLines.push(this.currentStdout.slice(0, -1));
            this.currentStdout = "";
        }
    }

    flush (): void {
        if (this.currentStdout.length != 0) {
            this.stdout("\n");
        }
        if (this.currentStderr.length != 0) {
            this.stderr("\n");
        }
    }
}
