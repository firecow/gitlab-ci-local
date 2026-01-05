/**
 * Shared formatting utilities for the web frontend
 */

// Colors for different jobs in resource charts
export const JOB_COLORS = [
    {cpu: "#4CAF50", memory: "#81C784"}, // Green
    {cpu: "#2196F3", memory: "#64B5F6"}, // Blue
    {cpu: "#FF9800", memory: "#FFB74D"}, // Orange
    {cpu: "#9C27B0", memory: "#BA68C8"}, // Purple
    {cpu: "#F44336", memory: "#E57373"}, // Red
    {cpu: "#00BCD4", memory: "#4DD0E1"}, // Cyan
    {cpu: "#795548", memory: "#A1887F"}, // Brown
    {cpu: "#607D8B", memory: "#90A4AE"}, // Blue Grey
];

/**
 * Format a timestamp to a readable date string
 */
export function formatDate (timestamp: number | null): string {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString();
}

/**
 * Format a duration in milliseconds to human readable format
 */
export function formatDuration (duration: number | null): string {
    if (!duration) return "N/A";
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}
