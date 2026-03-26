// Trace recorder module: records task and execution-unit events in memory for runtime visibility.
import type { ExecutionUnitId, StringMap, TaskId, TraceRef } from "../../../Runtime/Schema/runtime.js";
import { HistoryStoreService } from "../../../Data/history-store.js";

export const TRACE_EVENT_TYPES = {
  agentExecutionFinished: "agent_execution_finished",
  agentExecutionStarted: "agent_execution_started",
  agentObservationFinished: "agent_observation_finished",
  agentPlanCreated: "agent_plan_created",
  artifactPersisted: "artifact_persisted",
  contractChecked: "contract_checked",
  gateReviewed: "gate_reviewed",
  generationFinished: "generation_finished",
  generationStarted: "generation_started",
  llmExecutionFinished: "llm_execution_finished",
  llmExecutionStarted: "llm_execution_started",
  taskLaunchRequested: "task_launch_requested",
  validationFinished: "validation_finished",
} as const;

export type TraceEventType = (typeof TRACE_EVENT_TYPES)[keyof typeof TRACE_EVENT_TYPES];

export interface TraceEvent {
  executionUnitId?: ExecutionUnitId;
  caller: string;
  eventType: TraceEventType;
  summary: string;
  category?: string;
  metadata?: StringMap;
  payload?: Record<string, unknown>;
}

export interface TraceScope {
  taskId: TaskId;
  runId: string;
}

export interface ITraceRecorder {
  recordTrace(event: TraceEvent): Promise<TraceRef>;
}

export class InMemoryTraceRecorder implements ITraceRecorder {
  private readonly events: Array<{ ref: TraceRef; event: TraceEvent }> = [];

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
    this.validateTraceEvent(event);
    const ref = `trace-${this.events.length + 1}`;
    this.events.push({ ref, event });
    return ref;
  }

  getEvents(): Array<{ ref: TraceRef; event: TraceEvent }> {
    return [...this.events];
  }

  private validateTraceEvent(event: TraceEvent): void {
    if (!event.caller?.trim()) {
      throw new Error('Trace event requires a non-empty "caller".');
    }

    if (!event.eventType?.trim()) {
      throw new Error('Trace event requires a non-empty "eventType".');
    }
  }
}

export class TraceService implements ITraceRecorder {
  private scope?: TraceScope;

  constructor(
    private readonly historyStore: HistoryStoreService,
    scope?: TraceScope,
  ) {
    this.scope = scope;
  }

  async recordTrace(event: TraceEvent): Promise<TraceRef> {
    const taskId = this.scope?.taskId;
    const runId = this.scope?.runId;
    this.validateTraceEvent(event);
    const resolvedTaskId = taskId as string;
    const resolvedRunId = runId as string;
    const payload = event.payload && Object.keys(event.payload).length > 0
      ? event.payload
      : {
          eventType: event.eventType,
          metadata: event.metadata ?? {},
        };

    return this.historyStore.writeRecord({
      category: event.category ?? "trace",
      caller: event.caller,
      scope: {
        taskId: resolvedTaskId,
        runId: resolvedRunId,
        executionUnitId: event.executionUnitId ?? null,
      },
      summary: event.summary,
      payload,
    });
  }

  setScope(scope?: TraceScope): void {
    this.scope = scope;
  }

  private validateTraceEvent(event: TraceEvent): void {
    if (!this.scope?.taskId?.trim()) {
      throw new Error('Trace event requires a non-empty "taskId".');
    }

    if (!this.scope?.runId?.trim()) {
      throw new Error('Trace event requires a non-empty "runId".');
    }

    if (!event.caller?.trim()) {
      throw new Error('Trace event requires a non-empty "caller".');
    }

    if (!event.eventType?.trim()) {
      throw new Error('Trace event requires a non-empty "eventType".');
    }
  }
}
