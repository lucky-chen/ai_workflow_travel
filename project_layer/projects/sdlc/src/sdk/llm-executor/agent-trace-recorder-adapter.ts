import type { IAgentTraceRecorder, AgentTraceEvent } from "ai-meta-agent-agent-runtime";

import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";

export class AgentTraceRecorderAdapter implements IAgentTraceRecorder {
  constructor(private readonly traceRecorder: ITraceRecorder) {}

  async record(event: AgentTraceEvent): Promise<string> {
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

function toStringMap(payload?: Record<string, unknown>): Record<string, string> | undefined {
  if (!payload) {
    return undefined;
  }

  const entries = Object.entries(payload).map(([key, value]) => [key, String(value)] as const);
  return Object.fromEntries(entries);
}
