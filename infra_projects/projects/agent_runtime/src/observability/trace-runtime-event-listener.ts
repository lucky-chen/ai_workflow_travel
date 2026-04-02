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
  const brief = mapRuntimeBrief(message.event);
  if (!brief) {
    return [];
  }
  return [{
    type: "runtime",
    brief,
    metadata: {
      timestamp: message.timestamp,
    },
    details: omitUndefined({
      sessionId: message.sessionId,
      event: message.event,
      session: message.session,
      data: message.custom,
    }),
  }];
}

function mapAgentMessage(message: Extract<RuntimeEvent, { type: "agent" }>["agentMessage"]): TraceEvent[] {
  return [{
    type: "agent",
    brief: mapAgentBrief(message.agent),
    metadata: {
      timestamp: message.timestamp,
    },
    details: omitUndefined({
      sessionId: message.sessionId,
      agent: message.agent.name,
      step: message.agent.content.step,
      stepIndex: "stepIndex" in message.agent.content ? message.agent.content.stepIndex : undefined,
      input: summarizeStepInput(message.agent.content.input),
    }),
  }];
}

function mapModelMessage(message: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]): TraceEvent[] {
  return [{
    type: "model",
    brief: message.event === "model_started" ? "model.call.started" : "model.call.finished",
    metadata: {
      timestamp: message.timestamp,
    },
    details: omitUndefined({
      event: message.event,
      request: summarizeModelRequest(message.request),
      response: summarizeModelResponse(message.response),
      error: message.response?.error?.code ? message.response.error : undefined,
    }),
  }];
}

function mapToolMessage(message: Extract<RuntimeEvent, { type: "tool" }>["toolMessage"]): TraceEvent[] {
  return [{
    type: "tool",
    brief: message.event === "tool_started" ? "tool.call.started" : "tool.call.failed",
    metadata: {
      timestamp: message.timestamp,
    },
    details: omitUndefined({
      sessionId: message.sessionId,
      event: message.event,
      agent: message.agent.name,
      step: message.agent.content.step,
      stepIndex: "stepIndex" in message.agent.content ? message.agent.content.stepIndex : undefined,
      toolName: message.tool.toolName,
      arguments: summarizeToolArguments(message.tool.arguments),
      result: summarizeToolResult(message.tool.result),
      error: message.tool.error,
      blockedByPolicy: message.custom?.blockedByPolicy,
    }),
  }];
}

function mapRuntimeBrief(event: Extract<RuntimeEvent, { type: "runtime" }>["runtimeMessage"]["event"]): string | undefined {
  switch (event) {
    case "session_created":
      return "runtime.session.created";
    case "session_opened":
      return "runtime.session.opened";
    case "session_closed":
      return "runtime.session.closed";
    case "external_mcp_registered":
      return "runtime.mcp.registered";
    case "run_started":
      return "runtime.run.started";
    case "context_assembled":
      return "runtime.context.assembled";
    case "state_persisted":
      return "runtime.state.persisted";
    case "run_finished":
      return "runtime.run.finished";
    case "run_failed":
      return "runtime.run.failed";
    default:
      return undefined;
  }
}

function mapAgentBrief(agent: AgentEventAgent): string {
  if (agent.name === "chat") {
    return "chat.respond.input";
  }
  if (agent.name === "react") {
    switch (agent.content.step) {
      case "thought":
        return "react.thought.input";
      case "action":
        return "react.action.input";
      case "observation":
        return "react.observation.input";
      default:
        return "react.step.input";
    }
  }
  switch (agent.content.step) {
    case "plan":
      return "peo.plan.input";
    case "execution":
      return "peo.execution.input";
    case "observation":
      return "peo.observation.input";
    default:
      return "peo.step.input";
  }
}

function summarizeStepInput(input: Record<string, unknown>): Record<string, unknown> {
  return omitUndefined({
    stage: typeof input.stage === "string" ? input.stage : undefined,
    questionKeys: isRecord(input.question) ? Object.keys(input.question) : undefined,
    runtimeStateKeys: isRecord(input.runtimeState) ? Object.keys(input.runtimeState) : undefined,
    toolCallNames: Array.isArray(input.toolCalls)
      ? input.toolCalls
        .map((entry) => isRecord(entry) && typeof entry.name === "string" ? entry.name : undefined)
        .filter((value): value is string => typeof value === "string")
      : undefined,
    taskIds: Array.isArray(input.tasks)
      ? input.tasks
        .map((entry) => isRecord(entry) && typeof entry.taskId === "string" ? entry.taskId : undefined)
        .filter((value): value is string => typeof value === "string")
      : undefined,
    taskExecutionCount: Array.isArray(input.taskExecutions) ? input.taskExecutions.length : undefined,
    taskId: typeof input.taskId === "string" ? input.taskId : undefined,
    taskType: typeof input.taskType === "string" ? input.taskType : undefined,
  }) ?? {};
}

function summarizeModelRequest(
  request: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]["request"],
): Record<string, unknown> | undefined {
  if (!request) {
    return undefined;
  }
  return omitUndefined({
    responseFormat: request.responseFormat,
    systemPromptCount: request.systemPromptCount,
    stream: request.stream,
    userPromptKeys: Object.keys(request.userPrompt),
    stage: typeof request.userPrompt.stage === "string" ? request.userPrompt.stage : undefined,
  });
}

function summarizeModelResponse(
  response: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]["response"],
): Record<string, unknown> | undefined {
  if (!response) {
    return undefined;
  }
  return omitUndefined({
    hasContent: response.content.length > 0,
    contentLength: response.content.length,
    errorCode: response.error.code || undefined,
  });
}

function summarizeToolArguments(argumentsValue: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!argumentsValue) {
    return undefined;
  }
  return {
    keys: Object.keys(argumentsValue),
  };
}

function summarizeToolResult(
  result: {
    content: string;
    exitCode?: number;
    blockedByPolicy?: boolean;
  } | undefined,
): Record<string, unknown> | undefined {
  if (!result) {
    return undefined;
  }
  return omitUndefined({
    hasContent: result.content.length > 0,
    contentLength: result.content.length,
    exitCode: result.exitCode,
    blockedByPolicy: result.blockedByPolicy,
  });
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
