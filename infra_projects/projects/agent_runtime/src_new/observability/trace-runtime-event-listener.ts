import type { RuntimeEvent, AgentEventAgent } from "../capability/runtime-event.js";
import type { RuntimeEventListener } from "../capability/runtime-event-bus.js";
import type { Trace, TraceEvent } from "./trace.js";

export class TraceRuntimeEventListener implements RuntimeEventListener {
  constructor(private readonly trace: Trace) {}

  async onEvent(event: RuntimeEvent): Promise<void> {
    for (const mapped of mapRuntimeEventToTraceEvents(event)) {
      await this.trace.record(mapped);
    }
  }
}

export function mapRuntimeEventToTraceEvents(event: RuntimeEvent): TraceEvent[] {
  switch (event.type) {
    case "runtime":
      return mapRuntimeMessage(event.runtimeMessage);
    case "agent":
      return mapAgentMessage(event.agentMessage);
    case "model":
      return mapModelMessage(event.modelMessage);
    case "tool":
      return mapToolMessage(event.toolMessage);
    default:
      return [];
  }
}

function mapRuntimeMessage(message: Extract<RuntimeEvent, { type: "runtime" }>["runtimeMessage"]): TraceEvent[] {
  const common = traceCommon(message.timestamp, message.sessionId);
  if (
    message.event === "session_create_requested"
    || message.event === "session_created"
    || message.event === "session_open_requested"
    || message.event === "session_opened"
    || message.event === "session_closed"
    || message.event === "external_mcp_registered"
  ) {
    return [{
      scope: "sdk",
      eventType: message.event,
      payload: message.custom,
      ...common,
    }];
  }
  return [{
    scope: "session",
    eventType: message.event,
    payload: message.custom,
    ...common,
  }];
}

function mapAgentMessage(message: Extract<RuntimeEvent, { type: "agent" }>["agentMessage"]): TraceEvent[] {
  const common = traceCommon(message.timestamp, message.sessionId);
  return [{
    scope: "session",
    eventType: "agent_step_started",
    payload: buildStepPayload(message.agent),
    ...common,
  }];
}

function mapModelMessage(message: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]): TraceEvent[] {
  const common = traceCommon(message.timestamp);
  if (message.event === "model_started") {
    return [{
      scope: "session",
      eventType: "model_called",
      payload: {
        inputSummary: buildModelInputSummary(message),
      },
      ...common,
    }];
  }
  return [{
    scope: "session",
    eventType: "model_result_recorded",
    payload: {
      outputSummary: buildModelOutputSummary(message),
      error: message.response?.error?.code ? message.response.error : undefined,
    },
    ...common,
  }];
}

function mapToolMessage(message: Extract<RuntimeEvent, { type: "tool" }>["toolMessage"]): TraceEvent[] {
  const common = traceCommon(message.timestamp, message.sessionId);
  const payload = {
    ...buildStepPayload(message.agent),
    toolName: message.tool.toolName,
    arguments: message.tool.arguments,
    result: message.tool.result,
    error: message.tool.error,
    blockedByPolicy: message.custom?.blockedByPolicy,
  };
  if (message.event === "tool_started") {
    return [{
      scope: "session",
      eventType: "tool_called",
      payload,
      ...common,
    }];
  }
  return [{
    scope: "session",
    eventType: "tool_result_recorded",
    payload,
    ...common,
  }];
}

function traceCommon(timestamp: string, sessionId?: string): Pick<TraceEvent, "sessionId" | "metadata"> {
  return {
    sessionId,
    metadata: { timestamp },
  };
}

function buildStepPayload(agent?: AgentEventAgent): Record<string, unknown> {
  if (!agent) {
    return {};
  }
  return {
    agent: agent.name,
    step: agent.content.step,
    stepIndex: "stepIndex" in agent.content ? agent.content.stepIndex : undefined,
    input: agent.content.input,
  };
}

function buildModelInputSummary(message: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]): Record<string, unknown> | undefined {
  return omitUndefined({
    responseFormat: message.request?.responseFormat,
    systemPromptCount: message.request?.systemPromptCount,
    stream: message.request?.stream,
    userPromptKeys: message.request ? Object.keys(message.request.userPrompt) : undefined,
  });
}

function buildModelOutputSummary(message: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]): Record<string, unknown> | undefined {
  return omitUndefined({
    responseFormat: message.request?.responseFormat,
    systemPromptCount: message.request?.systemPromptCount,
    stream: message.request?.stream,
    userPromptKeys: message.request ? Object.keys(message.request.userPrompt) : undefined,
    hasContent: Boolean(message.response?.content),
    error: message.response?.error?.code ? message.response.error : undefined,
  });
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
