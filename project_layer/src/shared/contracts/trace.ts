import type { StageId, TaskId } from "../types/common.js";

export interface TraceEvent {
  taskId: TaskId;
  stageId?: StageId;
  eventType: string;
  summary: string;
}

export interface ITraceRecorder {
  recordTrace(event: TraceEvent): Promise<string>;
}
