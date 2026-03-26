import type { AgentTraceEvent, SessionRunTraceEvent, ValidationIssue } from "./agent-runtime-types.js";
import type {
  ExecutionPlan,
  ExecutionResult,
  McpToolResult,
  ObservationResult,
} from "./agent-runtime-types.js";

function createSessionEvent(
  sessionId: string,
  runId: string,
  eventType: SessionRunTraceEvent["eventType"],
  caller: string,
  summary: string,
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
    summary,
    payload,
    ...(diagnostics ? { diagnostics } : {}),
  };
}

export function buildRunStartedEvent(sessionId: string, runId: string): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "run_started", "DefaultAgent.run", "Runtime run started.");
}

export function buildPlanGeneratedEvent(sessionId: string, runId: string, plan: ExecutionPlan): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "plan_generated", "DefaultPlanner.plan", "Execution plan generated.", {
    mode: plan.mode,
    stepIndex: plan.stepIndex,
  });
}

export function buildToolCalledEvent(sessionId: string, runId: string, toolResult: McpToolResult): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "tool_called", "DefaultExecutor.execute", `Tool called: ${toolResult.toolName}.`, {
    toolName: toolResult.toolName,
  });
}

export function buildToolResultRecordedEvent(sessionId: string, runId: string, toolResult: McpToolResult): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "tool_result_recorded",
    "DefaultExecutor.execute",
    `Tool result recorded: ${toolResult.toolName}.`,
    {
      toolName: toolResult.toolName,
      success: toolResult.success,
    },
  );
}

export function buildExecutionFinishedEvent(
  sessionId: string,
  runId: string,
  executionResult: ExecutionResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "execution_finished",
    "DefaultExecutor.execute",
    "Execution finished.",
    {
      responseFormat: executionResult.responseFormat,
      toolResultCount: executionResult.toolResults?.length ?? 0,
    },
  );
}

export function buildObservationFinishedEvent(
  sessionId: string,
  runId: string,
  observation: ObservationResult,
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "observation_finished",
    "DefaultObserver.observe",
    "Observation finished.",
    {
      accepted: observation.accepted,
      completed: observation.completed ?? false,
    },
  );
}

export function buildRunFinishedEvent(
  sessionId: string,
  runId: string,
  observation: ObservationResult,
): AgentTraceEvent {
  return createSessionEvent(sessionId, runId, "run_finished", "DefaultAgent.run", "Runtime run finished.", {
    accepted: observation.accepted,
    completed: observation.completed ?? false,
  });
}

export function buildValidationFailedEvent(
  sessionId: string,
  runId: string,
  diagnostics: ValidationIssue[],
): AgentTraceEvent {
  return createSessionEvent(
    sessionId,
    runId,
    "validation_failed",
    "DefaultAgent.run",
    "Validation failed.",
    undefined,
    diagnostics,
  );
}
