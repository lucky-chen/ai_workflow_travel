// Trace recorder module: records task and stage events in memory for workflow visibility.
import type { TraceRef } from "../../shared/types/common.js";
import type { ITraceRecorder, TraceEvent } from "../../shared/contracts/pipeline.js";
import { HistoryStoreService } from "../../data/history-store/history-store.js";

export class InMemoryTraceRecorder implements ITraceRecorder {
  private readonly events: Array<{ ref: TraceRef; event: TraceEvent }> = [];

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
    const ref = `trace-${this.events.length + 1}`;
    this.events.push({ ref, event });
    return ref;
  }

  getEvents(): Array<{ ref: TraceRef; event: TraceEvent }> {
    return [...this.events];
  }
}

export class TraceService implements ITraceRecorder {
  constructor(private readonly historyStore: HistoryStoreService) {}

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
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
