// Shared trace contract: defines task and stage trace events for workflow visibility.
import type { StageId, StringMap, TaskId, TraceRef } from "../types/common.js";

export interface TraceEvent {
  taskId: TaskId;
  stageId?: StageId;
  eventType: string;
  summary: string;
  metadata?: StringMap;
}

export interface ITraceRecorder {
  recordTrace(event: TraceEvent): Promise<TraceRef>;
}
