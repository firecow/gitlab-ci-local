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

/**
 * Format bytes to human readable size
 */
export function formatBytes (bytes: number | null): string {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

/**
 * Format bytes to GB with 2 decimal places
 */
export function formatMemoryGB (bytes: number | null): string {
    if (!bytes) return "0 GB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

/**
 * Get CSS badge class for job/pipeline status
 */
export function getStatusBadgeClass (status: string): string {
    const map: Record<string, string> = {
        success: "badge-success",
        failed: "badge-error",
        running: "badge-running",
        pending: "badge-pending",
        canceled: "badge-warning",
        skipped: "badge-warning",
    };
    return "badge " + (map[status] || "badge-pending");
}

/**
 * Get icon character for job status
 */
export function getStatusIcon (status: string): string {
    const icons: Record<string, string> = {
        success: "\u2713", // ✓
        failed: "\u2715", // ✕
        warning: "!",
        running: "\u25C9", // ◉
        pending: "\u25CB", // ○
    };
    return icons[status] || "\u25CB";
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml (text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
