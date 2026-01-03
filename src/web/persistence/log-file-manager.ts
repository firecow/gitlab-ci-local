import fs from "fs-extra";
import path from "path";
import readline from "readline";

export interface LogLine {
    lineNumber: number;
    stream: "stdout" | "stderr";
    content: string;
    timestamp: number;
}

export class LogFileManager {
    private stateDir: string;
    private logsDir: string;
    private writeStreams: Map<string, fs.WriteStream> = new Map();

    constructor (stateDir: string) {
        this.stateDir = stateDir;
        this.logsDir = path.join(stateDir, "logs");
        fs.ensureDirSync(this.logsDir);
    }

    private getLogPath (pipelineId: string, jobId: string): string {
        return path.join(this.logsDir, pipelineId, `${jobId}.log`);
    }

    private getJobDir (pipelineId: string): string {
        return path.join(this.logsDir, pipelineId);
    }

    appendLog (pipelineId: string, jobId: string, line: Omit<LogLine, "lineNumber">, lineNumber: number): void {
        const logPath = this.getLogPath(pipelineId, jobId);
        const jobDir = this.getJobDir(pipelineId);

        // Ensure directory exists
        fs.ensureDirSync(jobDir);

        // Get or create write stream for this job
        const streamKey = `${pipelineId}/${jobId}`;
        if (!this.writeStreams.has(streamKey)) {
            const stream = fs.createWriteStream(logPath, {flags: "a"});
            this.writeStreams.set(streamKey, stream);
        }

        // Write log line as JSON (one line per entry for easy parsing)
        const logEntry = JSON.stringify({
            n: lineNumber,
            s: line.stream === "stdout" ? "o" : "e",
            c: line.content,
            t: line.timestamp,
        });

        this.writeStreams.get(streamKey)!.write(logEntry + "\n");
    }

    flushJob (pipelineId: string, jobId: string): void {
        const streamKey = `${pipelineId}/${jobId}`;
        const stream = this.writeStreams.get(streamKey);
        if (stream) {
            stream.end();
            this.writeStreams.delete(streamKey);
        }
    }

    flushAll (): void {
        for (const stream of this.writeStreams.values()) {
            stream.end();
        }
        this.writeStreams.clear();
    }

    async getJobLogs (pipelineId: string, jobId: string, offset: number = 0, limit: number = 1000): Promise<LogLine[]> {
        const logPath = this.getLogPath(pipelineId, jobId);

        if (!fs.existsSync(logPath)) {
            return [];
        }

        const logs: LogLine[] = [];
        let lineIndex = 0;

        const fileStream = fs.createReadStream(logPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        for await (const line of rl) {
            if (lineIndex >= offset && logs.length < limit) {
                try {
                    const entry = JSON.parse(line);
                    logs.push({
                        lineNumber: entry.n,
                        stream: entry.s === "o" ? "stdout" : "stderr",
                        content: entry.c,
                        timestamp: entry.t,
                    });
                } catch {
                    // Skip malformed lines
                }
            }
            lineIndex++;
            if (logs.length >= limit) {
                break;
            }
        }

        fileStream.destroy();
        return logs;
    }

    async getJobLogCount (pipelineId: string, jobId: string): Promise<number> {
        const logPath = this.getLogPath(pipelineId, jobId);

        if (!fs.existsSync(logPath)) {
            return 0;
        }

        let count = 0;
        const fileStream = fs.createReadStream(logPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of rl) {
            count++;
        }

        fileStream.destroy();
        return count;
    }

    deletePipelineLogs (pipelineId: string): void {
        const pipelineDir = this.getJobDir(pipelineId);
        if (fs.existsSync(pipelineDir)) {
            fs.removeSync(pipelineDir);
        }
    }

    deleteJobLogs (pipelineId: string, jobId: string): void {
        const logPath = this.getLogPath(pipelineId, jobId);
        if (fs.existsSync(logPath)) {
            fs.removeSync(logPath);
        }
    }

    cleanup (): void {
        this.flushAll();
    }
}
