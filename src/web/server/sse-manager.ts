import http from 'http';
import {GCLEvent} from '../events/event-types.js';

export class SSEManager {
    private connections: Map<string, Set<http.ServerResponse>> = new Map();
    private eventBuffer: Map<string, GCLEvent[]> = new Map();
    private readonly BUFFER_SIZE = 100;

    handleConnection(req: http.IncomingMessage, res: http.ServerResponse) {
        const pipelineId = this.extractPipelineId(req.url!);
        if (!pipelineId) {
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end('Missing pipeline ID');
            return;
        }

        // Setup SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Send initial comment to establish connection
        res.write(': connected\n\n');

        // Add to connections
        if (!this.connections.has(pipelineId)) {
            this.connections.set(pipelineId, new Set());
        }
        this.connections.get(pipelineId)!.add(res);

        // Send buffered events
        const buffered = this.eventBuffer.get(pipelineId) || [];
        buffered.forEach(event => this.sendEvent(res, event));

        // Cleanup on disconnect
        req.on('close', () => {
            this.connections.get(pipelineId)?.delete(res);
            if (this.connections.get(pipelineId)?.size === 0) {
                this.connections.delete(pipelineId);
            }
        });
    }

    broadcast(pipelineId: string, event: GCLEvent) {
        // Buffer event for reconnections
        if (!this.eventBuffer.has(pipelineId)) {
            this.eventBuffer.set(pipelineId, []);
        }
        const buffer = this.eventBuffer.get(pipelineId)!;
        buffer.push(event);
        if (buffer.length > this.BUFFER_SIZE) {
            buffer.shift();
        }

        // Send to connected clients
        const connections = this.connections.get(pipelineId);
        if (!connections) return;

        connections.forEach(res => this.sendEvent(res, event));
    }

    private sendEvent(res: http.ServerResponse, event: GCLEvent) {
        try {
            const data = JSON.stringify(event);
            res.write(`data: ${data}\n\n`);
        } catch (error) {
            // Ignore write errors for disconnected clients
        }
    }

    private extractPipelineId(url: string): string | null {
        // Extract pipeline ID from /events/pipelines/:id
        const match = url.match(/\/events\/pipelines\/([^/?]+)/);
        return match ? match[1] : null;
    }

    closeAll() {
        this.connections.forEach(conns => {
            conns.forEach(res => {
                try {
                    res.end();
                } catch {
                    // Ignore errors for already closed connections
                }
            });
        });
        this.connections.clear();
        this.eventBuffer.clear();
    }

    getConnectionCount(pipelineId?: string): number {
        if (pipelineId) {
            return this.connections.get(pipelineId)?.size || 0;
        }
        let total = 0;
        this.connections.forEach(conns => total += conns.size);
        return total;
    }
}
