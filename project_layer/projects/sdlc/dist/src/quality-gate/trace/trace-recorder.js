export class InMemoryTraceRecorder {
    events = [];
    async recordTrace(event) {
        const ref = `trace-${this.events.length + 1}`;
        this.events.push({ ref, event });
        return ref;
    }
    getEvents() {
        return [...this.events];
    }
}
export class TraceService {
    historyStore;
    constructor(historyStore) {
        this.historyStore = historyStore;
    }
    async recordTrace(event) {
        return this.historyStore.writeRecord({
            category: "trace",
            taskId: event.taskId,
            stageId: event.stageId,
            summary: event.summary,
            payload: {
                eventType: event.eventType,
                metadata: event.metadata ?? {},
            },
        });
    }
}
