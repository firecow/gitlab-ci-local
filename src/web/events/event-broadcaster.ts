import {EventEmitter} from "./event-emitter.js";
import {EventType, GCLEvent} from "./event-types.js";
import {SSEManager} from "../server/sse-manager.js";

export class EventBroadcaster {
    private emitter: EventEmitter;
    private sseManager: SSEManager;
    private boundOnEvent: (event: GCLEvent) => void;

    constructor (sseManager: SSEManager) {
        this.emitter = EventEmitter.getInstance();
        this.sseManager = sseManager;
        // Store bound reference to allow proper cleanup
        this.boundOnEvent = this.onEvent.bind(this);
        this.registerListeners();
    }

    private registerListeners () {
        // Register listeners for all event types
        Object.values(EventType).forEach(type => {
            this.emitter.on(type, this.boundOnEvent);
        });
    }

    private onEvent (event: GCLEvent) {
        // Broadcast event to SSE clients for this pipeline
        this.sseManager.broadcast(event.pipelineId, event);
    }

    cleanup () {
        // Remove all registered listeners
        Object.values(EventType).forEach(type => {
            this.emitter.off(type, this.boundOnEvent);
        });
    }
}
