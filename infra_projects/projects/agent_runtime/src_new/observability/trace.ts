import type { Storage } from "../data/storage.js";
import { PersistentObservabilityBuffer } from "./persistent-observability-buffer.js";

export type TraceEvent =
  | {
    type: "runtime";
    brief: string;
    details?: Record<string, unknown>;
    metadata?: {
      timestamp: string;
    };
  }
  | {
    type: "agent";
    brief: string;
    details?: Record<string, unknown>;
    metadata?: {
      timestamp: string;
    };
  }
  | {
    type: "model";
    brief: string;
    details?: Record<string, unknown>;
    metadata?: {
      timestamp: string;
    };
  }
  | {
    type: "tool";
    brief: string;
    details?: Record<string, unknown>;
    metadata?: {
      timestamp: string;
    };
  };

export interface TraceResult {
  events: TraceEvent[];
}

export interface Trace {
  record(event: TraceEvent): Promise<void>;
  get(): Promise<TraceResult>;
  flush(): Promise<void>;
  getTraceId(): string;
}

export class Trace extends PersistentObservabilityBuffer implements Trace {
  private events: TraceEvent[] = [];
  private readonly runId: string;

  constructor(storage: Storage, runId: string) {
    super(storage, `traces/trace_${runId}`);
    this.runId = runId;
    this.initializeLoading(() => this.loadPersisted());
  }

  async record(event: TraceEvent): Promise<void> {
    await this.ensureLoaded();
    const normalized = normalizeTraceEvent(event);
    this.events.push(normalized);
    await this.recordMutation(isImmediateFlushEvent(normalized.brief));
  }

  async get(): Promise<TraceResult> {
    await this.ensureLoaded();
    return {
      events: [...this.events],
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

  getTraceId(): string {
    return this.runId;
  }
}

function normalizeTraceEvent(event: TraceEvent): TraceEvent {
  const now = new Date().toISOString();
  return {
    ...event,
    metadata: {
      timestamp: event.metadata?.timestamp || now,
    },
  };
}

function isImmediateFlushEvent(brief: string): boolean {
  return brief === "runtime.session.closed"
    || brief === "runtime.state.persisted"
    || brief === "runtime.run.failed"
    || brief === "runtime.run.finished";
}
