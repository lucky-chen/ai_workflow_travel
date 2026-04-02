import type { SessionEvent } from "../interface/api.js";
import type { AgentEvent } from "../interface/agent-api.js";
import type { TraceEvent } from "./trace.js";

export function mapSessionEventToTraceEvents(event: SessionEvent): TraceEvent[] {
  return [{
    type: "session",
    brief: event.brief,
    metadata: {
      timestamp: event.timestamp,
    },
    details: omitUndefined({
      sessionId: event.sessionId,
      traceId: event.traceId,
      ...(event.details ?? {}),
    }),
  }];
}

export function mapAgentEventToTraceEvents(event: AgentEvent, sessionId?: string): TraceEvent[] {
  return [{
    type: "agent",
    brief: event.brief,
    metadata: {
      timestamp: event.timestamp,
    },
    details: omitUndefined({
      sessionId,
      ...(event.details ?? {}),
    }),
  }];
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
