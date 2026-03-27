import type { AgentTraceEvent, SessionRunTraceEvent, ValidationIssue } from "./agent-runtime-types.js";
import type {
  ExecutionPlan,
  ExecutionResult,
  ModelTraceFacts,
  McpToolResult,
  ObservationResult,
} from "./agent-runtime-types.js";

function createSessionEvent(
  sessionId: string,
  runId: string,
  eventType: SessionRunTraceEvent["eventType"],
  caller: string,
  summary: string,
  stepIndex?: number,
  payload?: Record<string, unknown>,
  diagnostics?: ValidationIssue[],
): SessionRunTraceEvent {
  return {
    scope: "session",
    sessionId,
    runId,
    traceId: runId,
    timestamp: new Date().toISOString(),
    eventType,
    caller,
    ...(stepIndex !== undefined ? { stepIndex } : {}),
    summary,
    payload,
    ...(diagnostics ? { diagnostics } : {}),
  };
}

export function buildRunStartedEvent(sessionId: string, runId: string): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "run_started", "DefaultAgent.run", "Runtime run started.");
}

export function buildPlanStartedEvent(sessionId: string, runId: string, stepIndex: number): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "plan_started", "DefaultAgent.run", "Planning started.", stepIndex, {
    stepIndex,
  });
}

export function buildPlanGeneratedEvent(sessionId: string, runId: string, plan: ExecutionPlan): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "plan_generated",
    "DefaultPlanner.plan",
    "Execution plan generated.",
    plan.stepIndex,
    {
      mode: plan.mode,
      intent: plan.intent,
      stepIndex: plan.stepIndex,
      nextStepGoal: plan.nextStepGoal,
      toolNames: plan.toolSteps?.map((toolStep) => toolStep.toolName) ?? [],
      toolCallIds: plan.toolSteps?.map((toolStep) => toolStep.toolCallId) ?? [],
      ...buildModelTracePayload(plan.traceFacts),
    },
  );
}

export function buildExecuteStartedEvent(sessionId: string, runId: string, plan: ExecutionPlan): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "execute_started",
    "DefaultAgent.run",
    "Execution started.",
    plan.stepIndex,
    {
      stepIndex: plan.stepIndex,
      intent: plan.intent,
      mode: plan.mode,
      nextStepGoal: plan.nextStepGoal,
      toolNames: plan.toolSteps?.map((toolStep) => toolStep.toolName) ?? [],
      toolCallIds: plan.toolSteps?.map((toolStep) => toolStep.toolCallId) ?? [],
      planningRequestType: plan.traceFacts?.requestType,
      planningProvider: plan.traceFacts?.provider,
      planningModel: plan.traceFacts?.model,
    },
  );
}

export function buildToolCalledEvent(
  sessionId: string,
  runId: string,
  stepIndex: number,
  toolResult: McpToolResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "tool_called",
    "DefaultExecutor.execute",
    `Tool called: ${toolResult.toolName}.`,
    stepIndex,
    {
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      argumentsPreview: createArgumentsPreview(toolResult.arguments),
    },
  );
}

export function buildToolResultRecordedEvent(
  sessionId: string,
  runId: string,
  stepIndex: number,
  toolResult: McpToolResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "tool_result_recorded",
    "DefaultExecutor.execute",
    `Tool result recorded: ${toolResult.toolName}.`,
    stepIndex,
    {
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      argumentsPreview: createArgumentsPreview(toolResult.arguments),
      success: toolResult.success,
      toolResultPreview: createContentPreview(toolResult.content),
    },
  );
}

export function buildExecutionFinishedEvent(
  sessionId: string,
  runId: string,
  stepIndex: number,
  executionResult: ExecutionResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "execution_finished",
    "DefaultExecutor.execute",
    "Execution finished.",
    stepIndex,
    {
      responseFormat: executionResult.responseFormat,
      toolResultCount: executionResult.toolResults?.length ?? 0,
      toolCallIds: executionResult.toolResults?.map((toolResult) => toolResult.toolCallId) ?? [],
      ...buildModelTracePayload(executionResult.traceFacts),
    },
  );
}

export function buildObserveStartedEvent(
  sessionId: string,
  runId: string,
  plan: ExecutionPlan,
  executionResult: ExecutionResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "observe_started",
    "DefaultAgent.run",
    "Observation started.",
    plan.stepIndex,
    {
      stepIndex: plan.stepIndex,
      responseFormat: executionResult.responseFormat,
      toolResultCount: executionResult.toolResults?.length ?? 0,
      executionContentPreview: createContentPreview(executionResult.content),
    },
  );
}

export function buildObservationFinishedEvent(
  sessionId: string,
  runId: string,
  stepIndex: number,
  observation: ObservationResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "observation_finished",
    "DefaultObserver.observe",
    "Observation finished.",
    stepIndex,
    {
      accepted: observation.accepted,
      completed: observation.completed ?? false,
      observationSummaryPreview: createContentPreview(observation.summary),
    },
  );
}

export function buildRunFinishedEvent(
  sessionId: string,
  runId: string,
  observation: ObservationResult,
  stepIndex?: number,
): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "run_finished", "DefaultAgent.run", "Runtime run finished.", stepIndex, {
    accepted: observation.accepted,
    completed: observation.completed ?? false,
    stopReason: observation.completed ? "completed" : "continue",
    observationSummaryPreview: createContentPreview(observation.summary),
  });
}

export function buildRunFailedEvent(
  sessionId: string,
  runId: string,
  summary: string,
  stopReason: "failed" | "max_steps",
  stepIndex?: number,
): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "run_finished", "DefaultAgent.run", "Runtime run finished.", stepIndex, {
    accepted: false,
    completed: false,
    summary,
    stopReason,
  });
}

export function buildValidationFailedEvent(
  sessionId: string,
  runId: string,
  stepIndex: number,
  phase: "plan" | "execution" | "observation",
  action: "repair" | "replan" | "fail",
  diagnostics: ValidationIssue[],
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "validation_failed",
    "DefaultAgent.run",
    "Validation failed.",
    stepIndex,
    {
      phase,
      action,
      stepIndex,
    },
    diagnostics,
  );
}

function buildModelTracePayload(traceFacts?: ModelTraceFacts): Record<string, unknown> {
  if (!traceFacts) {
    return {};
  }

  return {
    requestType: traceFacts.requestType,
    provider: traceFacts.provider,
    model: traceFacts.model,
    timeoutMs: traceFacts.timeoutMs,
    httpStatus: traceFacts.httpStatus,
    responseFormat: traceFacts.responseFormat,
    finishReason: traceFacts.finishReason,
    usage: traceFacts.usage,
    responseShape: traceFacts.responseShape,
    systemPromptPreview: traceFacts.systemPromptPreview,
    userPromptPreview: traceFacts.userPromptPreview,
    requestBodyPreview: traceFacts.requestBodyPreview,
    rawResponsePreview: traceFacts.rawResponsePreview,
    parsedContentPreview: traceFacts.parsedContentPreview,
  };
}

function createContentPreview(content: string): { text: string; truncated: boolean } {
  return {
    text: content.slice(0, 400),
    truncated: content.length > 400,
  };
}

function createArgumentsPreview(argumentsValue: Record<string, unknown>): { text: string; truncated: boolean } {
  const serialized = JSON.stringify(argumentsValue);
  return {
    text: serialized.slice(0, 400),
    truncated: serialized.length > 400,
  };
}
