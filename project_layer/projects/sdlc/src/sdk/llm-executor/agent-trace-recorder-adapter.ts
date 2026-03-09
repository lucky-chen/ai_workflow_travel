import type { IAgentTraceRecorder, AgentTraceEvent } from "ai-meta-agent-agent-runtime";

import type { ITraceRecorder, TraceEventType } from "../../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../../shared/contracts/pipeline.js";

export class AgentTraceRecorderAdapter implements IAgentTraceRecorder {
  constructor(private readonly traceRecorder: ITraceRecorder) {}

  async record(event: AgentTraceEvent): Promise<string> {
    return this.traceRecorder.recordTrace({
      taskId: "llm-executor",
      caller: "AgentTraceRecorderAdapter.record",
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
