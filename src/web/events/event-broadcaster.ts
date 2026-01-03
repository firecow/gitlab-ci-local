import {EventEmitter} from "./event-emitter.js";
import {EventType, GCLEvent} from "./event-types.js";
import {SSEManager} from "../server/sse-manager.js";

export class EventBroadcaster {
    private emitter: EventEmitter;
    private sseManager: SSEManager;

    constructor (sseManager: SSEManager) {
        this.emitter = EventEmitter.getInstance();
        this.sseManager = sseManager;
        this.registerListeners();
    }

    private registerListeners () {
        // Register listeners for all event types
        Object.values(EventType).forEach(type => {
            this.emitter.on(type, this.onEvent.bind(this));
        });
    }

    private onEvent (event: GCLEvent) {
        // Broadcast event to SSE clients for this pipeline
        this.sseManager.broadcast(event.pipelineId, event);
    }

    cleanup () {
        // Event emitter cleanup handled by removeAllListeners if needed
    }
}
