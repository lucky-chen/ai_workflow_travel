import type { AgentTraceEvent, IAgentTraceRecorder } from "./agent-trace-recorder.js";
import {
  buildExecutionFinishedEvent,
  buildExecutionStartedEvent,
  buildObservationFinishedEvent,
  buildPlanCreatedEvent,
  buildToolCalledEvent,
  buildToolResultRecordedEvent,
} from "./agent-trace-events.js";
import type { ExecutionPlan, ExecutionResult, McpToolResult, ObservationResult } from "./agent-runtime-types.js";

export class AgentTraceApi {
  constructor(private readonly traceRecorder?: IAgentTraceRecorder) {}

  async recordPlanCreated(runId: string, plan: ExecutionPlan): Promise<void> {
    await this.record(buildPlanCreatedEvent(runId, plan));
  }

  async recordExecutionStarted(runId: string, plan: ExecutionPlan): Promise<void> {
    await this.record(buildExecutionStartedEvent(runId, plan));
  }

  async recordToolResults(runId: string, toolResults?: McpToolResult[]): Promise<void> {
    for (const toolResult of toolResults ?? []) {
      await this.record(buildToolCalledEvent(runId, toolResult));
      await this.record(buildToolResultRecordedEvent(runId, toolResult));
    }
  }

  async recordExecutionFinished(runId: string, executionResult: ExecutionResult): Promise<void> {
    await this.record(buildExecutionFinishedEvent(runId, executionResult));
  }

  async recordObservationFinished(runId: string, observation: ObservationResult): Promise<void> {
    await this.record(buildObservationFinishedEvent(runId, observation));
  }

  private async record(event: AgentTraceEvent): Promise<void> {
    await this.traceRecorder?.record(event);
  }
}
