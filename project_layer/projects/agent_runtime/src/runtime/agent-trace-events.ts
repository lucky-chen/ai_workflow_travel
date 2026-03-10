import type { AgentTraceEvent } from "./agent-trace-recorder.js";
import type {
  ExecutionPlan,
  ExecutionResult,
  McpToolResult,
  ObservationResult,
} from "./agent-runtime-types.js";

export function buildPlanCreatedEvent(runId: string, plan: ExecutionPlan): AgentTraceEvent {
  return {
    runId,
    caller: "DefaultPlanner.plan",
    eventType: "agent_plan_created",
    summary: "Agent plan created.",
    payload: {
      mode: plan.mode,
    },
  };
}

export function buildExecutionStartedEvent(runId: string, plan: ExecutionPlan): AgentTraceEvent {
  return {
    runId,
    caller: "DefaultExecutor.execute",
    eventType: "agent_execution_started",
    summary: "Agent execution started.",
    payload: {
      mode: plan.mode,
      toolStepCount: String(plan.toolSteps?.length ?? 0),
    },
  };
}

export function buildToolCalledEvent(runId: string, toolResult: McpToolResult): AgentTraceEvent {
  return {
    runId,
    caller: "DefaultMcpGateway.callTool",
    eventType: "agent_tool_called",
    summary: `Agent tool called: ${toolResult.toolName}.`,
    payload: {
      toolName: toolResult.toolName,
      success: String(toolResult.success),
    },
  };
}

export function buildToolResultRecordedEvent(runId: string, toolResult: McpToolResult): AgentTraceEvent {
  return {
    runId,
    caller: "DefaultMcpGateway.callTool",
    eventType: "agent_tool_result_recorded",
    summary: `Agent tool result recorded: ${toolResult.toolName}.`,
    payload: {
      toolName: toolResult.toolName,
      success: String(toolResult.success),
    },
  };
}

export function buildExecutionFinishedEvent(
  runId: string,
  executionResult: ExecutionResult,
): AgentTraceEvent {
  return {
    runId,
    caller: "DefaultExecutor.execute",
    eventType: "agent_execution_finished",
    summary: "Agent execution finished.",
    payload: {
      responseFormat: executionResult.result.responseFormat,
      toolResultCount: String(executionResult.toolResults?.length ?? 0),
    },
  };
}

export function buildObservationFinishedEvent(
  runId: string,
  observation: ObservationResult,
): AgentTraceEvent {
  return {
    runId,
    caller: "DefaultObserver.observe",
    eventType: "agent_observation_finished",
    summary: "Agent observation finished.",
    payload: {
      accepted: observation.accepted,
    },
  };
}
