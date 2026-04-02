import { randomUUID } from "node:crypto";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  SessionEvent,
  SessionEventListener,
} from "../interface/api.js";
import { ContextAssembler } from "../context/context-assembler.js";
import { createRetrievalProvider } from "../context/retrieval-provider.js";
import { createRuntimeMemory } from "../context/runtime-memory.js";
import { createSessionTranscript } from "../context/session-transcript.js";
import { createIntentRouter } from "../orchestration/intent_router/index.js";
import { createTrace } from "../observability/trace.js";
import type { Trace } from "../observability/trace.js";
import { AgentSession } from "./agent-session.js";
import type { Storage } from "../data/storage.js";
import type { AgentRuntimeComponents, AgentSessionLike, SessionRuntimeComponents, SessionEventSink } from "./types.js";
import { mapSessionEventToTraceEvents } from "../observability/trace_event_mapper.js";

export class SessionService {
  private readonly sessions = new Map<string, AgentSessionLike>();
  private readonly traces = new Map<string, Trace>();
  private readonly listeners = new Set<SessionEventListener>();
  private readonly sessionComponents: SessionRuntimeComponents;

  constructor(
    private readonly workdir: string,
    private readonly storage: Storage,
    private readonly agentComponents: AgentRuntimeComponents,
    private readonly initialization: Promise<void>,
  ) {
    const sessionTranscript = createSessionTranscript(storage);
    const runtimeMemory = createRuntimeMemory(storage);
    this.sessionComponents = {
      intentRouter: createIntentRouter({
        modelFactory: agentComponents.modelFactory,
      }),
      sessionTranscript,
      runtimeMemory,
      contextAssembler: new ContextAssembler(
        sessionTranscript,
        runtimeMemory,
        createRetrievalProvider(workdir),
      ),
    };
  }

  subscribeEvents(listener: SessionEventListener): void {
    this.listeners.add(listener);
  }

  unsubscribeEvents(listener: SessionEventListener): void {
    this.listeners.delete(listener);
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    await this.initialization;
    await this.emit({
      brief: "session_create_requested",
      traceId: randomUUID(),
      timestamp: new Date().toISOString(),
      details: {
        mode: "create",
      },
    });
    const sessionId = randomUUID();
    const trace = this.getOrCreateTrace(sessionId);
    const session = await AgentSession.create(
      { ...input, sessionId },
      this.storage,
      this.agentComponents,
      this.sessionComponents,
      trace,
      this.createSessionEventSink(),
    );
    this.sessions.set(sessionId, session);
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    await this.initialization;
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to open a session.");
    }
    await this.emit({
      brief: "session_open_requested",
      sessionId,
      traceId: randomUUID(),
      timestamp: new Date().toISOString(),
      details: {
        mode: "open",
      },
    });
    const cached = this.sessions.get(sessionId);
    if (cached instanceof AgentSession) {
      await this.emit({
        brief: "session_opened",
        sessionId,
        timestamp: new Date().toISOString(),
        details: {
          mode: "open",
        },
      });
      return cached;
    }
    const trace = this.getOrCreateTrace(sessionId);
    const session = await AgentSession.open(
      sessionId,
      this.storage,
      this.agentComponents,
      this.sessionComponents,
      trace,
      this.createSessionEventSink(),
    );
    this.sessions.set(sessionId, session);
    return session;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    await this.initialization;
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to close a session.");
    }
    const cached = this.sessions.get(sessionId);
    const session = cached instanceof AgentSession
      ? cached
      : await AgentSession.loadForClose(
        sessionId,
        this.storage,
        this.agentComponents,
        this.sessionComponents,
        this.getOrCreateTrace(sessionId),
        this.createSessionEventSink(),
      );
    if (session.isRunning()) {
      throw new Error(`Session ${sessionId} is running and cannot be closed.`);
    }
    await session.close();
    this.sessions.delete(sessionId);
    await this.emit({
      brief: "session_closed",
      sessionId,
      traceId: randomUUID(),
      timestamp: new Date().toISOString(),
      details: {
        mode: "close",
      },
    });
    return { sessionId };
  }

  private createSessionEventSink(): SessionEventSink {
    return {
      emit: async (event: SessionEvent) => {
        await this.emit(event);
      },
    };
  }

  private getOrCreateTrace(sessionId: string): Trace {
    const cached = this.traces.get(sessionId);
    if (cached) {
      return cached;
    }
    const trace = createTrace(this.storage, sessionId);
    this.traces.set(sessionId, trace);
    return trace;
  }

  private async emit(event: SessionEvent): Promise<void> {
    await this.writeTrace(event);
    for (const listener of [...this.listeners]) {
      await listener.onEvent(event);
    }
  }

  private async writeTrace(event: SessionEvent): Promise<void> {
    if (!event.sessionId) {
      return;
    }
    const trace = this.getOrCreateTrace(event.sessionId);
    for (const traceEvent of mapSessionEventToTraceEvents(event)) {
      await trace.record(traceEvent);
    }
    await trace.flush();
  }
}
