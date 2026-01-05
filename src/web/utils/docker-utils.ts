/**
 * Shared Docker utilities
 */

/**
 * Match a container ID that may be full or truncated.
 * Docker stats may return short IDs (12 chars) while we track full IDs.
 *
 * @param fullId The full container ID we're tracking
 * @param queryId The ID returned from docker stats (may be short)
 * @returns true if the IDs match
 */
export function matchContainerId (fullId: string, queryId: string): boolean {
    return fullId.startsWith(queryId) || queryId.startsWith(fullId.substring(0, 12));
}
