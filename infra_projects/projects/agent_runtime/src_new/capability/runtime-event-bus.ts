import type { Trace, TraceEvent } from "../observability/trace.js";
import type { RuntimeEvent, RuntimeEventCallback } from "./runtime-event.js";

export interface RuntimeEventListener {
  onEvent(event: RuntimeEvent): Promise<void>;
}

export class RuntimeEventBus {
  constructor(private readonly listeners: RuntimeEventListener[]) {}

  async publish(event: RuntimeEvent): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onEvent(event);
    }
  }
}

export class CallbackRuntimeEventListener implements RuntimeEventListener {
  constructor(private readonly callback: RuntimeEventCallback) {}

  async onEvent(event: RuntimeEvent): Promise<void> {
    await this.callback.onEvent(event);
  }
}

export class TraceRuntimeEventListener implements RuntimeEventListener {
  constructor(private readonly trace: Trace) {}

  async onEvent(event: RuntimeEvent): Promise<void> {
    const mapped = mapRuntimeEventToTraceEvent(event);
    if (!mapped) {
      return;
    }
    await this.trace.record(mapped);
  }
}

function mapRuntimeEventToTraceEvent(event: RuntimeEvent): TraceEvent | undefined {
  const common = {
    sessionId: event.metadata.sessionId,
    metadata: {
      traceId: event.metadata.traceId ?? "",
      timestamp: event.metadata.timestamp,
    },
  };
  switch (event.type) {
    case "session_create_requested":
    case "session_created":
    case "session_open_requested":
    case "session_opened":
    case "session_closed":
    case "external_mcp_registered":
      return {
        scope: "sdk",
        eventType: event.type,
        payload: event.custom,
        ...common,
      };
    case "run_started":
    case "context_assembled":
    case "state_persisted":
    case "run_finished":
    case "run_failed":
      return {
        scope: "session",
        eventType: event.type,
        payload: event.custom,
        ...common,
      };
    case "agent_selected":
      return {
        scope: "session",
        eventType: "agent_selected",
        payload: {
          agent: event.agent?.name,
        },
        ...common,
      };
    case "model_started":
      return {
        scope: "session",
        eventType: "model_called",
        payload: buildModelPayload(event),
        ...common,
      };
    case "model_completed":
      return {
        scope: "session",
        eventType: "model_result_recorded",
        payload: {
          ...buildModelPayload(event),
          error: event.custom?.error,
        },
        ...common,
      };
    case "tool_started":
      return {
        scope: "session",
        eventType: "tool_called",
        payload: {
          toolName: event.agent?.tool?.toolName,
        },
        ...common,
      };
    case "tool_completed":
      return {
        scope: "session",
        eventType: "tool_result_recorded",
        payload: {
          toolName: event.agent?.tool?.toolName,
          arguments: event.agent?.tool?.arguments,
          blockedByPolicy: event.custom?.blockedByPolicy,
          error: event.agent?.tool?.error,
        },
        ...common,
      };
    default:
      return undefined;
  }
}

function buildModelPayload(event: RuntimeEvent): Record<string, unknown> {
  if (event.agent?.name === "chat") {
    return {
      stage: event.agent.chat?.stage ?? "chat",
    };
  }
  if (event.agent?.name === "react") {
    return {
      stage: event.agent.react?.step ? `react_${event.agent.react.step}` : "react",
      stepIndex: event.agent.react?.stepIndex,
    };
  }
  if (event.agent?.name === "peo") {
    return {
      stage: event.agent.peo?.step ? `peo_${event.agent.peo.step}` : "peo",
      stepIndex: event.agent.peo?.stepIndex,
      taskId: event.agent.peo?.taskId,
      taskType: event.agent.peo?.taskType,
      taskStatus: event.agent.peo?.taskStatus,
      taskCount: event.agent.peo?.taskCount,
    };
  }
  return {};
}
