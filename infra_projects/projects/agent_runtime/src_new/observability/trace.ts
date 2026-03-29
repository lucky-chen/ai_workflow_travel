import { randomUUID } from "node:crypto";

import type { Storage } from "../data/storage.js";
import { PersistentObservabilityBuffer } from "./persistent-observability-buffer.js";

export type TraceEventType =
  | "session_create_requested"
  | "session_created"
  | "session_open_requested"
  | "session_opened"
  | "session_closed"
  | "run_started"
  | "context_assembled"
  | "agent_selected"
  | "agent_step_started"
  | "model_called"
  | "model_result_recorded"
  | "tool_called"
  | "tool_result_recorded"
  | "state_persisted"
  | "run_failed"
  | "run_finished";

export type TraceScope = "sdk" | "session";

export interface TraceEvent {
  traceId: string;
  scope: TraceScope;
  eventType: TraceEventType;
  timestamp: string;
  summary: string;
  sessionId?: string;
  runId?: string;
  stepIndex?: number;
  payload?: Record<string, unknown>;
  diagnostics?: Array<{
    code: string;
    message: string;
  }>;
}

export interface TraceResult {
  events: TraceEvent[];
}

export interface Trace {
  record(event: TraceEvent): Promise<void>;
  get(sessionId?: string, runId?: string, traceId?: string, scope?: TraceScope): Promise<TraceResult>;
  flush(): Promise<void>;
}

export class Trace extends PersistentObservabilityBuffer implements Trace {
  private events: TraceEvent[] = [];

  constructor(storage: Storage) {
    super(storage, "trace/events");
    this.initializeLoading(() => this.loadPersisted());
  }

  async record(event: TraceEvent): Promise<void> {
    await this.ensureLoaded();
    const normalized = normalizeTraceEvent(event);
    this.events.push(normalized);
    await this.recordMutation(isImmediateFlushEvent(normalized.eventType));
  }

  async get(sessionId?: string, runId?: string, traceId?: string, scope?: TraceScope): Promise<TraceResult> {
    await this.ensureLoaded();

    return {
      events: this.events.filter((event) => {
        if (sessionId && event.sessionId !== sessionId) {
          return false;
        }
        if (runId && event.runId !== runId) {
          return false;
        }
        if (traceId && event.traceId !== traceId) {
          return false;
        }
        if (scope && event.scope !== scope) {
          return false;
        }
        return true;
      }),
    };
  }

  protected buildPersistedPayload(): Record<string, unknown> {
    return {
      events: this.events,
    };
  }

  private async loadPersisted(): Promise<void> {
    const payload = await this.loadPersistedPayload();
    if (!Array.isArray(payload?.events)) {
      return;
    }
    this.events = payload.events
      .filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === "object")
      .map((event) => normalizeTraceEvent(event as unknown as TraceEvent));
    this.resetDirtyEntryCount();
  }
}

export function createTraceId(): string {
  return randomUUID();
}

function normalizeTraceEvent(event: TraceEvent): TraceEvent {
  return {
    ...event,
    traceId: event.traceId || createTraceId(),
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

function isImmediateFlushEvent(eventType: TraceEventType): boolean {
  return eventType === "session_closed"
    || eventType === "state_persisted"
    || eventType === "run_failed"
    || eventType === "run_finished";
}
