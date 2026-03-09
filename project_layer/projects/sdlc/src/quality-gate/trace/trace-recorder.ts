// Trace recorder module: records task and stage events in memory for workflow visibility.
import type { TraceRef } from "../../shared/types/common.js";
import type { ITraceRecorder, TraceEvent } from "../../shared/contracts/pipeline.js";
import { HistoryStoreService } from "../../data/history-store/history-store.js";

export class InMemoryTraceRecorder implements ITraceRecorder {
  private readonly events: Array<{ ref: TraceRef; event: TraceEvent }> = [];

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
    this.validateTraceEvent(event);
    const ref = `trace-${this.events.length + 1}`;
    this.events.push({ ref, event });
    return ref;
  }

  getEvents(): Array<{ ref: TraceRef; event: TraceEvent }> {
    return [...this.events];
  }

  private validateTraceEvent(event: TraceEvent): void {
    if (!event.caller?.trim()) {
      throw new Error('Trace event requires a non-empty "caller".');
    }

    if (!event.eventType?.trim()) {
      throw new Error('Trace event requires a non-empty "eventType".');
    }
  }
}

export class TraceService implements ITraceRecorder {
  constructor(private readonly historyStore: HistoryStoreService) {}

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
    this.validateTraceEvent(event);
    const payload = event.payload && Object.keys(event.payload).length > 0
      ? event.payload
      : {
          eventType: event.eventType,
          metadata: event.metadata ?? {},
        };

    return this.historyStore.writeRecord({
      category: event.category ?? "trace",
      scope: {
        taskId: event.taskId,
        ...(event.stageId ? { stageId: event.stageId } : {}),
      },
      summary: event.summary,
      payload,
    });
  }

  private validateTraceEvent(event: TraceEvent): void {
    if (!event.caller?.trim()) {
      throw new Error('Trace event requires a non-empty "caller".');
    }

    if (!event.eventType?.trim()) {
      throw new Error('Trace event requires a non-empty "eventType".');
    }
  }
}
