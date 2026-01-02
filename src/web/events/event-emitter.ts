import {EventType, GCLEvent, EventListener} from './event-types.js';

// Global event emitter with singleton pattern and zero overhead when disabled
export class EventEmitter {
    private static instance: EventEmitter;
    private listeners: Map<EventType, Set<EventListener>> = new Map();
    private enabled: boolean = false;

    private constructor() {}

    static getInstance(): EventEmitter {
        if (!this.instance) {
            this.instance = new EventEmitter();
        }
        return this.instance;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    emit(event: GCLEvent) {
        // Zero overhead check - return immediately if disabled
        if (!this.enabled) return;

        const listeners = this.listeners.get(event.type);
        if (!listeners || listeners.size === 0) return;

        // Call all listeners for this event type
        listeners.forEach(fn => {
            try {
                fn(event);
            } catch (error) {
                // Silently catch listener errors to prevent breaking the pipeline
                console.error(`Error in event listener for ${event.type}:`, error);
            }
        });
    }

    on(type: EventType, callback: EventListener) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(callback);
    }

    off(type: EventType, callback: EventListener) {
        this.listeners.get(type)?.delete(callback);
    }

    once(type: EventType, callback: EventListener) {
        const onceWrapper: EventListener = (event: GCLEvent) => {
            callback(event);
            this.off(type, onceWrapper);
        };
        this.on(type, onceWrapper);
    }

    removeAllListeners(type?: EventType) {
        if (type) {
            this.listeners.delete(type);
        } else {
            this.listeners.clear();
        }
    }

    listenerCount(type: EventType): number {
        return this.listeners.get(type)?.size ?? 0;
    }
}
