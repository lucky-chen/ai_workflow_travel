import { randomUUID } from "node:crypto";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  RuntimeApi,
  RuntimeCreateOptions,
} from "../interface/api.js";
import { AgentSession } from "./agent-session.js";
import { AgentSessionManager } from "./agent-session-manager.js";
import {
  type RuntimeEventListener,
} from "../capability/runtime-event-bus.js";
import { RuntimeAssembly } from "./runtime-assembly.js";
import type {
  RuntimeComponents,
} from "./types.js";
import type { Storage } from "../data/storage.js";

export class Runtime implements RuntimeApi {
  private readonly storage: Storage;
  private readonly sessionManager = new AgentSessionManager();
  private readonly components: RuntimeComponents;
  private readonly runtimeRunId = randomUUID();
  private readonly initialization: Promise<void>;

  constructor(private readonly options: RuntimeCreateOptions) {
    const assembly = new RuntimeAssembly(this.runtimeRunId, options);
    this.storage = assembly.storage;
    this.components = assembly.components;
    this.initialization = assembly.initialization;
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    await this.initialization;
    await this.components.eventBus.publish({
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
    const session = await AgentSession.create({ ...input, sessionId }, this.storage, this.components);
    await this.sessionManager.put(sessionId, session);
    await this.components.trace.flush();
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    await this.initialization;
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to open a session.");
    }
    await this.components.eventBus.publish({
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
    const cached = await this.sessionManager.get(sessionId);
    if (cached instanceof AgentSession) {
      await this.components.eventBus.publish({
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
      await this.components.trace.flush();
      return cached;
    }
    const session = await AgentSession.open(sessionId, this.storage, this.components);
    await this.sessionManager.put(sessionId, session);
    await this.components.trace.flush();
    return session;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    await this.initialization;
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to close a session.");
    }
    const cached = await this.sessionManager.get(sessionId);
    const session = cached instanceof AgentSession
      ? cached
      : await AgentSession.loadForClose(sessionId, this.storage, this.components);
    if (session.isRunning()) {
      throw new Error(`Session ${sessionId} is running and cannot be closed.`);
    }
    await session.close();
    await this.sessionManager.remove(sessionId);
    await this.components.eventBus.publish({
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
    await this.components.trace.flush();
    return { sessionId };
  }

  subscribeEvents(listener: RuntimeEventListener): void {
    this.components.eventBus.subscribe(listener);
  }

  unsubscribeEvents(listener: RuntimeEventListener): void {
    this.components.eventBus.unsubscribe(listener);
  }
}

export function createRuntime(options: RuntimeCreateOptions): Runtime {
  return new Runtime(options);
}
