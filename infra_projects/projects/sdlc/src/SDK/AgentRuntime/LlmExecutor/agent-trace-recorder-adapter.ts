import type { IAgentTraceRecorder, AgentTraceEvent } from "ai-meta-agent-agent-runtime";

import type { ITraceRecorder, TraceEventType } from "../../../SDK/QualityControl/Trace/trace-recorder.js";
import { TRACE_EVENT_TYPES } from "../../../SDK/QualityControl/Trace/trace-recorder.js";

export class AgentTraceRecorderAdapter implements IAgentTraceRecorder {
  constructor(private readonly traceRecorder: ITraceRecorder) {}

  async record(event: AgentTraceEvent): Promise<string> {
    return this.traceRecorder.recordTrace({
      caller: event.caller,
      eventType: this.toTraceEventType(event.eventType),
      summary: event.summary,
      metadata: {
        runId: event.runId,
        ...(toStringMap(event.payload) ?? {}),
      },
    });
  }

  private toTraceEventType(eventType: string): TraceEventType {
    const supportedEventTypes = Object.values(TRACE_EVENT_TYPES) as string[];
    if (!supportedEventTypes.includes(eventType)) {
      throw new Error(`Unsupported agent trace event type "${eventType}".`);
    }

    return eventType as TraceEventType;
  }
}

function toStringMap(payload?: Record<string, unknown>): Record<string, string> | undefined {
  if (!payload) {
    return undefined;
  }

  const entries = Object.entries(payload).map(([key, value]) => [key, String(value)] as const);
  return Object.fromEntries(entries);
}
