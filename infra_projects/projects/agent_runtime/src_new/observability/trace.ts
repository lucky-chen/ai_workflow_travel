import type { Storage } from "../data/storage.js";
import { TraceRecorder } from "./trace-recorder.js";

export interface TraceEvent {
  type: "runtime" | "agent" | "model" | "tool";
  brief: string;
  details?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface TraceResult {
  events: TraceEvent[];
}

export interface Trace {
  record(event: TraceEvent): Promise<void>;
  get(): Promise<TraceResult>;
  flush(): Promise<void>;
  getTraceId(): string;
}

export function createTrace(storage: Storage, runId: string): Trace {
  return new TraceRecorder(storage, runId);
}
