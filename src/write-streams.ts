export interface WriteStreams {
    stdout: (txt: string) => void;
    stderr: (txt: string) => void;
    flush: () => void;
}
