// Trace recorder module: records task and stage events in memory for workflow visibility.
import type { ITraceRecorder, TraceEvent } from "../../shared/contracts/trace.js";
import type { TraceRef } from "../../shared/types/common.js";

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
