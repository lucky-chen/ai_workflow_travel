import type { Storage } from "../data/storage.js";
import { PersistentObservabilityBuffer } from "./persistent-observability-buffer.js";
import type { Trace, TraceEvent, TraceResult } from "./trace.js";

export class TraceRecorder extends PersistentObservabilityBuffer implements Trace {
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
      timestamp: typeof event.metadata?.timestamp === "string" ? event.metadata.timestamp : now,
    },
  };
}

function isImmediateFlushEvent(brief: string): boolean {
  return brief === "session_closed"
    || brief === "state_persisted"
    || brief === "run_failed"
    || brief === "run_finished";
}
