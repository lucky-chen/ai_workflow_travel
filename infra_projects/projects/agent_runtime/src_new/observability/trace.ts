import { randomUUID } from "node:crypto";

import type { Storage } from "../data/storage.js";

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
  caller: string;
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

export class StorageBackedTrace implements Trace {
  private events: TraceEvent[] = [];

  constructor(private readonly storage: Storage) {}

  async record(event: TraceEvent): Promise<void> {
    this.events.push(normalizeTraceEvent(event));
  }

  async get(sessionId?: string, runId?: string, traceId?: string, scope?: TraceScope): Promise<TraceResult> {
    if (this.events.length === 0) {
      await this.loadPersisted();
    }

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

  async flush(): Promise<void> {
    await this.storage.save("trace/events", {
      events: this.events,
    });
  }

  private async loadPersisted(): Promise<void> {
    try {
      const payload = await this.storage.load("trace/events");
      if (!Array.isArray(payload.events)) {
        return;
      }
      this.events = payload.events
        .filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === "object")
        .map((event) => normalizeTraceEvent(event as unknown as TraceEvent));
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
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

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
