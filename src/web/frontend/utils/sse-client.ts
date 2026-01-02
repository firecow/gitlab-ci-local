// SSE client for real-time event streaming
export class SSEClient {
    private eventSource: EventSource | null = null;
    private url: string;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;

    constructor(url: string) {
        this.url = url;
    }

    // Connect to SSE endpoint
    connect() {
        if (this.eventSource) {
            return;
        }

        this.eventSource = new EventSource(this.url);

        this.eventSource.onopen = () => {
            console.log('SSE connected');
            this.reconnectAttempts = 0;
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnect attempts reached');
                this.close();
            }
        };

        // Listen for message events (generic event)
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const eventType = data.type;

                // Trigger listeners for this event type
                const listeners = this.listeners.get(eventType);
                if (listeners) {
                    listeners.forEach(callback => callback(data));
                }

                // Also trigger wildcard listeners
                const wildcardListeners = this.listeners.get('*');
                if (wildcardListeners) {
                    wildcardListeners.forEach(callback => callback(data));
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };
    }

    // Register event listener for specific event type
    on(eventType: string, callback: (data: any) => void) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(callback);
    }

    // Remove event listener
    off(eventType: string, callback: (data: any) => void) {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    // Close connection
    close() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.listeners.clear();
    }
}

// Create SSE client for a specific pipeline
export function createPipelineSSE(pipelineId: string): SSEClient {
    return new SSEClient(`/events/pipelines/${pipelineId}`);
}
