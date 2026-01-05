import {Utils} from "./utils.js";
import {matchContainerId} from "./web/utils/docker-utils.js";

export interface ContainerStats {
    containerId: string;
    jobName: string;
    cpuPercent: number;
    memoryPercent: number;
    memoryBytes?: number; // Memory usage in bytes for absolute display
    timestamp: number;
}

export interface ContainerSummary {
    avgCpu: number;
    avgMemory: number;
    peakCpu: number;
    peakMemory: number;
    sampleCount: number;
}

interface ContainerStatsAccumulator {
    jobName: string;
    samples: {cpu: number; memory: number; timestamp: number}[];
    startTime: number;
}

// Singleton ResourceMonitor for tracking Docker container stats
export class ResourceMonitor {
    private static instance: ResourceMonitor | null = null;

    private containers: Map<string, ContainerStatsAccumulator> = new Map();
    private pollingInterval: NodeJS.Timeout | null = null;
    private containerExecutable: string;
    private readonly POLL_INTERVAL_MS = 5000; // 5 seconds
    private readonly MAX_HISTORY_SECONDS = 60; // Keep 60 seconds of history
    private readonly MAX_SAMPLES = 12; // 60s / 5s = 12 samples

    private constructor (containerExecutable: string) {
        this.containerExecutable = containerExecutable;
    }

    static getInstance (containerExecutable?: string): ResourceMonitor | null {
        if (!ResourceMonitor.instance && containerExecutable) {
            ResourceMonitor.instance = new ResourceMonitor(containerExecutable);
        }
        return ResourceMonitor.instance;
    }

    static resetInstance (): void {
        if (ResourceMonitor.instance) {
            ResourceMonitor.instance.stop();
            ResourceMonitor.instance = null;
        }
    }

    // Register a container for monitoring
    addContainer (containerId: string, jobName: string): void {
        if (!this.containers.has(containerId)) {
            this.containers.set(containerId, {
                jobName,
                samples: [],
                startTime: Date.now(),
            });
        }
    }

    // Remove container and return summary stats
    removeContainer (containerId: string): ContainerSummary | null {
        const accumulator = this.containers.get(containerId);
        if (!accumulator) return null;

        const summary = this.calculateSummary(accumulator);
        this.containers.delete(containerId);
        return summary;
    }

    // Calculate avg/peak stats from accumulated samples
    private calculateSummary (accumulator: ContainerStatsAccumulator): ContainerSummary {
        const samples = accumulator.samples;
        if (samples.length === 0) {
            return {avgCpu: 0, avgMemory: 0, peakCpu: 0, peakMemory: 0, sampleCount: 0};
        }

        let totalCpu = 0;
        let totalMemory = 0;
        let peakCpu = 0;
        let peakMemory = 0;

        for (const sample of samples) {
            totalCpu += sample.cpu;
            totalMemory += sample.memory;
            peakCpu = Math.max(peakCpu, sample.cpu);
            peakMemory = Math.max(peakMemory, sample.memory);
        }

        return {
            avgCpu: Math.round((totalCpu / samples.length) * 100) / 100,
            avgMemory: Math.round((totalMemory / samples.length) * 100) / 100,
            peakCpu: Math.round(peakCpu * 100) / 100,
            peakMemory: Math.round(peakMemory * 100) / 100,
            sampleCount: samples.length,
        };
    }

    // Start polling docker stats
    start (): void {
        if (this.pollingInterval) return;

        // Poll immediately, then every POLL_INTERVAL_MS
        this.poll();
        this.pollingInterval = setInterval(() => {
            this.poll();
        }, this.POLL_INTERVAL_MS);
    }

    // Stop polling
    stop (): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    // Check if actively polling
    isPolling (): boolean {
        return this.pollingInterval !== null;
    }

    // Get container count
    getContainerCount (): number {
        return this.containers.size;
    }

    // Get current stats for all containers
    getCurrentStats (): ContainerStats[] {
        const stats: ContainerStats[] = [];
        const now = Date.now();

        for (const [containerId, accumulator] of this.containers) {
            const latestSample = accumulator.samples[accumulator.samples.length - 1];
            if (latestSample) {
                stats.push({
                    containerId: containerId.substring(0, 12),
                    jobName: accumulator.jobName,
                    cpuPercent: latestSample.cpu,
                    memoryPercent: latestSample.memory,
                    timestamp: latestSample.timestamp,
                });
            } else {
                // No samples yet, return zeros
                stats.push({
                    containerId: containerId.substring(0, 12),
                    jobName: accumulator.jobName,
                    cpuPercent: 0,
                    memoryPercent: 0,
                    timestamp: now,
                });
            }
        }

        return stats;
    }

    // Get recent history for graphing (last N seconds)
    getRecentHistory (seconds: number = 60): Map<string, ContainerStats[]> {
        const history = new Map<string, ContainerStats[]>();
        const cutoff = Date.now() - (seconds * 1000);

        for (const [containerId, accumulator] of this.containers) {
            const recentSamples = accumulator.samples
                .filter(s => s.timestamp >= cutoff)
                .map(s => ({
                    containerId: containerId.substring(0, 12),
                    jobName: accumulator.jobName,
                    cpuPercent: s.cpu,
                    memoryPercent: s.memory,
                    timestamp: s.timestamp,
                }));

            if (recentSamples.length > 0) {
                history.set(accumulator.jobName, recentSamples);
            }
        }

        return history;
    }

    // Poll docker stats for all tracked containers using JSON format
    private async poll (): Promise<void> {
        if (this.containers.size === 0) return;

        const containerIds = Array.from(this.containers.keys());

        try {
            // Query all containers at once using JSON format for reliable parsing
            const cmd = `${this.containerExecutable} stats --no-stream --format json ${containerIds.join(" ")}`;

            const {stdout} = await Utils.bash(cmd, process.cwd());
            const now = Date.now();

            // Parse JSON output (one JSON object per line)
            const lines = stdout.trim().split("\n").filter(l => l.length > 0);
            for (const line of lines) {
                try {
                    const stat = JSON.parse(line);
                    const containerId = stat.Container || stat.ID || "";
                    const cpuStr = (stat.CPUPerc || "0%").replace("%", "");
                    const memStr = (stat.MemPerc || "0%").replace("%", "");

                    const cpu = parseFloat(cpuStr) || 0;
                    const memory = parseFloat(memStr) || 0;

                    // Find matching container (docker stats may return short ID)
                    for (const [fullId, accumulator] of this.containers) {
                        if (matchContainerId(fullId, containerId)) {
                            accumulator.samples.push({cpu, memory, timestamp: now});

                            // Prune old samples
                            while (accumulator.samples.length > this.MAX_SAMPLES) {
                                accumulator.samples.shift();
                            }
                            break;
                        }
                    }
                } catch {
                    // Skip lines that aren't valid JSON (e.g., warnings)
                }
            }
        } catch {
            // Ignore errors (container may have exited)
        }
    }
}
