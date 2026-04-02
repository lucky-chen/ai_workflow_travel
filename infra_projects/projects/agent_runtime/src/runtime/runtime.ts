import { randomUUID } from "node:crypto";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  SessionApi,
  RuntimeCreateOptions,
} from "../interface/api.js";
import { AgentSession } from "./agent-session.js";
import {
  type RuntimeEventListener,
} from "../capability/runtime-event-bus.js";
import { RuntimeAssembly } from "./runtime-assembly.js";
import { SessionService } from "./session-service.js";
import type { Storage } from "../data/storage.js";
import type { AgentRuntimeComponents } from "./types.js";

export class Runtime implements SessionApi {
  private readonly sessionService: SessionService;
  private readonly components: AgentRuntimeComponents;
  private readonly storage: Storage;

  constructor(private readonly options: RuntimeCreateOptions) {
    const assembly = new RuntimeAssembly(randomUUID(), options);
    this.components = assembly.components;
    this.storage = assembly.storage;
    this.sessionService = new SessionService(
      options.workdir,
      this.storage,
      assembly.components,
      assembly.initialization,
    );
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    return this.sessionService.createSession(input);
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    return this.sessionService.openSession(sessionId);
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    return this.sessionService.closeSession(sessionId);
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
