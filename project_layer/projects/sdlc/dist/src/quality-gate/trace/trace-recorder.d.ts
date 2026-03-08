import type { TraceRef } from "../../shared/types/common.js";
import type { ITraceRecorder, TraceEvent } from "../../shared/contracts/pipeline.js";
import { HistoryStoreService } from "../../data/history-store/history-store.js";
export declare class InMemoryTraceRecorder implements ITraceRecorder {
    private readonly events;
    recordTrace(event: TraceEvent): Promise<TraceRef>;
    getEvents(): Array<{
        ref: TraceRef;
        event: TraceEvent;
    }>;
}
export declare class TraceService implements ITraceRecorder {
    private readonly historyStore;
    constructor(historyStore: HistoryStoreService);
    recordTrace(event: TraceEvent): Promise<TraceRef>;
}
