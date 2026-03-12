// Trace recorder module: records task and stage events in memory for workflow visibility.
import type { TraceRef } from "../shared/types/common.js";
import type { ITraceRecorder, TraceEvent, TraceScope } from "../shared/contracts/pipeline.js";
import { HistoryStoreService } from "../data/history-store.js";

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
  private scope?: TraceScope;

  constructor(
    private readonly historyStore: HistoryStoreService,
    scope?: TraceScope,
  ) {
    this.scope = scope;
  }

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
    const taskId = this.scope?.taskId;
    const runId = this.scope?.runId;
    this.validateTraceEvent(event);
    const resolvedTaskId = taskId as string;
    const resolvedRunId = runId as string;
    const payload = event.payload && Object.keys(event.payload).length > 0
      ? event.payload
      : {
          eventType: event.eventType,
          metadata: event.metadata ?? {},
        };

    return this.historyStore.writeRecord({
      category: event.category ?? "trace",
      caller: event.caller,
      scope: {
        taskId: resolvedTaskId,
        runId: resolvedRunId,
        stageId: event.stageId ?? null,
      },
      summary: event.summary,
      payload,
    });
  }

  setScope(scope?: TraceScope): void {
    this.scope = scope;
  }

  private validateTraceEvent(event: TraceEvent): void {
    if (!this.scope?.taskId?.trim()) {
      throw new Error('Trace event requires a non-empty "taskId".');
    }

    if (!this.scope?.runId?.trim()) {
      throw new Error('Trace event requires a non-empty "runId".');
    }

    if (!event.caller?.trim()) {
      throw new Error('Trace event requires a non-empty "caller".');
    }

    if (!event.eventType?.trim()) {
      throw new Error('Trace event requires a non-empty "eventType".');
    }
  }
}
