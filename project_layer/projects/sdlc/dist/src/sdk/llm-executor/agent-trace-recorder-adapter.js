export class AgentTraceRecorderAdapter {
    traceRecorder;
    constructor(traceRecorder) {
        this.traceRecorder = traceRecorder;
    }
    async record(event) {
        return this.traceRecorder.recordTrace({
            taskId: "llm-executor",
            eventType: event.eventType,
            summary: event.summary,
            metadata: {
                runId: event.runId,
                ...(toStringMap(event.payload) ?? {}),
            },
        });
    }
}
function toStringMap(payload) {
    if (!payload) {
        return undefined;
    }
    const entries = Object.entries(payload).map(([key, value]) => [key, String(value)]);
    return Object.fromEntries(entries);
}
