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
  if (message.event === "agent_selected") {
    return [{
      scope: "session",
      eventType: "agent_selected",
      payload: {
        agent: message.agent.name,
        reasonCode: message.custom?.reasonCode,
        question: message.custom?.question,
      },
      ...common,
    }];
  }
  if (message.event === "agent_step_completed" || message.event === "task_completed") {
    return [{
      scope: "session",
      eventType: "agent_step_recorded",
      payload: {
        ...buildStepPayload(message.agent),
        result: buildAgentStepResult(message.agent),
      },
      ...common,
    }];
  }
  if (message.event === "task_selected") {
    return [{
      scope: "session",
      eventType: "agent_step_started",
      payload: {
        ...buildStepPayload(message.agent),
      },
      ...common,
    }];
  }
  return [];
}

function mapModelMessage(message: Extract<RuntimeEvent, { type: "model" }>["modelMessage"]): TraceEvent[] {
  const common = traceCommon(message.timestamp, message.sessionId);
  if (message.event === "model_started") {
    return [{
      scope: "session",
      eventType: "model_called",
      payload: {
        ...buildStepPayload(message.agent),
        inputSummary: buildModelInputSummary(message),
      },
      ...common,
    }];
  }
  return [{
    scope: "session",
    eventType: "model_result_recorded",
    payload: {
      ...buildStepPayload(message.agent),
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
  if (agent.name === "chat") {
    return { agent: "chat", step: "chat" };
  }
  if (agent.name === "react") {
    return {
      agent: "react",
      step: agent.react?.step,
      stepIndex: agent.react?.stepIndex,
      actionType: agent.react?.actionType,
    };
  }
  return {
    agent: "peo",
    step: agent.peo?.step,
    stepIndex: agent.peo?.stepIndex,
    taskId: agent.peo?.taskId,
    taskType: agent.peo?.taskType,
    taskStatus: agent.peo?.taskStatus,
    taskCount: agent.peo?.taskCount,
  };
}

function buildAgentStepResult(agent?: AgentEventAgent): Record<string, unknown> | undefined {
  if (!agent) {
    return undefined;
  }
  if (agent.name === "chat") {
    return agent.chat?.result ? { finalAnswer: agent.chat.result.finalAnswer } : undefined;
  }
  if (agent.name === "react") {
    if (agent.react?.step === "thought") {
      return omitUndefined({
        actionType: agent.react.actionType,
        toolName: agent.react.thoughtResult?.toolName,
        actionPayload: agent.react.thoughtResult?.actionPayload,
        finalAnswer: agent.react.thoughtResult?.finalAnswer,
      });
    }
    if (agent.react?.step === "observation") {
      return omitUndefined({
        summary: agent.react.observationResult?.summary,
        completed: agent.react.observationResult?.completed,
        finalAnswer: agent.react.observationResult?.finalAnswer,
      });
    }
    return undefined;
  }
  if (agent.peo?.step === "plan") {
    return omitUndefined({
      planSummary: agent.peo.planResult?.planSummary,
      tasks: agent.peo.planResult?.tasks,
      finalAnswer: agent.peo.planResult?.finalAnswer,
    });
  }
  if (agent.peo?.step === "observation") {
    return omitUndefined({
      taskResult: agent.peo.taskResult,
      observationResult: agent.peo.observationResult,
    });
  }
  return undefined;
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
