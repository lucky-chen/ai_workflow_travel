import { randomUUID } from "node:crypto";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
} from "../interface/api.js";
import { ContextAssembler } from "../context/context-assembler.js";
import { createRetrievalProvider } from "../context/retrieval-provider.js";
import { createRuntimeMemory } from "../context/runtime-memory.js";
import { createSessionTranscript } from "../context/session-transcript.js";
import { createIntentRouter } from "../orchestration/intent_router/index.js";
import { AgentSession } from "./agent-session.js";
import type { Storage } from "../data/storage.js";
import type { AgentRuntimeComponents, AgentSessionLike, SessionRuntimeComponents } from "./types.js";

export class SessionService {
  private readonly sessions = new Map<string, AgentSessionLike>();
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

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    await this.initialization;
    await this.agentComponents.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_create_requested",
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        session: {
          mode: "create",
        },
      },
    });
    const sessionId = randomUUID();
    const session = await AgentSession.create(
      { ...input, sessionId },
      this.storage,
      this.agentComponents,
      this.sessionComponents,
    );
    this.sessions.set(sessionId, session);
    await this.agentComponents.trace.flush();
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    await this.initialization;
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to open a session.");
    }
    await this.agentComponents.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_open_requested",
        sessionId,
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        session: {
          mode: "open",
        },
      },
    });
    const cached = this.sessions.get(sessionId);
    if (cached instanceof AgentSession) {
      await this.agentComponents.eventBus.publish({
        type: "runtime",
        runtimeMessage: {
          event: "session_opened",
          sessionId,
          timestamp: new Date().toISOString(),
          session: {
            mode: "open",
          },
        },
      });
      await this.agentComponents.trace.flush();
      return cached;
    }
    const session = await AgentSession.open(
      sessionId,
      this.storage,
      this.agentComponents,
      this.sessionComponents,
    );
    this.sessions.set(sessionId, session);
    await this.agentComponents.trace.flush();
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
      );
    if (session.isRunning()) {
      throw new Error(`Session ${sessionId} is running and cannot be closed.`);
    }
    await session.close();
    this.sessions.delete(sessionId);
    await this.agentComponents.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_closed",
        sessionId,
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        session: {
          mode: "close",
        },
      },
    });
    await this.agentComponents.trace.flush();
    return { sessionId };
  }
}
