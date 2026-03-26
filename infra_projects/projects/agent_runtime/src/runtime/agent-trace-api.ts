import type { AgentTraceEvent, IAgentTraceRecorder } from "./agent-trace-recorder.js";
import {
  buildExecutionFinishedEvent,
  buildObservationFinishedEvent,
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

  async recordPlanGenerated(sessionId: string, runId: string, plan: ExecutionPlan): Promise<void> {
    await this.record(buildPlanGeneratedEvent(sessionId, runId, plan));
  }

  async recordToolResults(sessionId: string, runId: string, toolResults?: McpToolResult[]): Promise<void> {
    for (const toolResult of toolResults ?? []) {
      await this.record(buildToolCalledEvent(sessionId, runId, toolResult));
      await this.record(buildToolResultRecordedEvent(sessionId, runId, toolResult));
    }
  }

  async recordExecutionFinished(sessionId: string, runId: string, executionResult: ExecutionResult): Promise<void> {
    await this.record(buildExecutionFinishedEvent(sessionId, runId, executionResult));
  }

  async recordObservationFinished(sessionId: string, runId: string, observation: ObservationResult): Promise<void> {
    await this.record(buildObservationFinishedEvent(sessionId, runId, observation));
  }

  async recordRunFinished(sessionId: string, runId: string, observation: ObservationResult): Promise<void> {
    await this.record(buildRunFinishedEvent(sessionId, runId, observation));
  }

  async recordValidationFailed(sessionId: string, runId: string, diagnostics: ValidationIssue[]): Promise<void> {
    await this.record(buildValidationFailedEvent(sessionId, runId, diagnostics));
  }

  private async record(event: AgentTraceEvent): Promise<void> {
    await this.traceRecorder?.record(event);
  }
}
