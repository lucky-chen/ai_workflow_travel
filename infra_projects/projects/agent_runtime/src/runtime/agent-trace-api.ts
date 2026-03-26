import type { AgentTraceEvent, IAgentTraceRecorder } from "./agent-trace-recorder.js";
import {
  buildExecuteStartedEvent,
  buildObserveStartedEvent,
  buildPlanStartedEvent,
  buildExecutionFinishedEvent,
  buildObservationFinishedEvent,
  buildRunFailedEvent,
  buildPlanGeneratedEvent,
  buildRunFinishedEvent,
  buildRunStartedEvent,
  buildToolCalledEvent,
  buildToolResultRecordedEvent,
  buildValidationFailedEvent,
} from "./agent-trace-events.js";
import type {
  ExecutionPlan,
  ExecutionResult,
  McpToolResult,
  ObservationResult,
  ValidationIssue,
} from "./agent-runtime-types.js";

export class AgentTraceApi {
  constructor(private readonly traceRecorder?: IAgentTraceRecorder) {}

  async recordRunStarted(sessionId: string, runId: string): Promise<void> {
    await this.record(buildRunStartedEvent(sessionId, runId));
  }

  async recordPlanStarted(sessionId: string, runId: string, stepIndex: number): Promise<void> {
    await this.record(buildPlanStartedEvent(sessionId, runId, stepIndex));
  }

  async recordPlanGenerated(sessionId: string, runId: string, plan: ExecutionPlan): Promise<void> {
    await this.record(buildPlanGeneratedEvent(sessionId, runId, plan));
  }

  async recordExecuteStarted(sessionId: string, runId: string, plan: ExecutionPlan): Promise<void> {
    await this.record(buildExecuteStartedEvent(sessionId, runId, plan));
  }

  async recordToolResults(
    sessionId: string,
    runId: string,
    stepIndex: number,
    toolResults?: McpToolResult[],
  ): Promise<void> {
    for (const toolResult of toolResults ?? []) {
      await this.record(buildToolCalledEvent(sessionId, runId, stepIndex, toolResult));
      await this.record(buildToolResultRecordedEvent(sessionId, runId, stepIndex, toolResult));
    }
  }

  async recordExecutionFinished(
    sessionId: string,
    runId: string,
    stepIndex: number,
    executionResult: ExecutionResult,
  ): Promise<void> {
    await this.record(buildExecutionFinishedEvent(sessionId, runId, stepIndex, executionResult));
  }

  async recordObserveStarted(
    sessionId: string,
    runId: string,
    plan: ExecutionPlan,
    executionResult: ExecutionResult,
  ): Promise<void> {
    await this.record(buildObserveStartedEvent(sessionId, runId, plan, executionResult));
  }

  async recordObservationFinished(
    sessionId: string,
    runId: string,
    stepIndex: number,
    observation: ObservationResult,
  ): Promise<void> {
    await this.record(buildObservationFinishedEvent(sessionId, runId, stepIndex, observation));
  }

  async recordRunFinished(
    sessionId: string,
    runId: string,
    stepIndex: number,
    observation: ObservationResult,
  ): Promise<void> {
    await this.record(buildRunFinishedEvent(sessionId, runId, observation, stepIndex));
  }

  async recordRunFailed(
    sessionId: string,
    runId: string,
    summary: string,
    stopReason: "failed" | "max_steps",
    stepIndex: number,
  ): Promise<void> {
    await this.record(buildRunFailedEvent(sessionId, runId, summary, stopReason, stepIndex));
  }

  async recordValidationFailed(
    sessionId: string,
    runId: string,
    stepIndex: number,
    phase: "plan" | "execution" | "observation",
    action: "repair" | "replan" | "fail",
    diagnostics: ValidationIssue[],
  ): Promise<void> {
    await this.record(buildValidationFailedEvent(sessionId, runId, stepIndex, phase, action, diagnostics));
  }

  private async record(event: AgentTraceEvent): Promise<void> {
    await this.traceRecorder?.record(event);
  }
}
