import { randomUUID } from "node:crypto";

import type {
  AgentType,
  IAgent,
} from "../interface/agent-api.js";
import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  RuntimeApi,
  RuntimeCreateOptions,
} from "../interface/api.js";
import { AgentSession } from "./agent-session.js";
import {
  type RuntimeEventListener,
} from "../capability/runtime-event-bus.js";
import { RuntimeAssembly } from "./runtime-assembly.js";
import { AgentService } from "./agent-service.js";
import { SessionService } from "./session-service.js";
import type { Storage } from "../data/storage.js";
import type { RuntimeSharedComponents } from "./types.js";

export class Runtime implements RuntimeApi {
  private readonly storage: Storage;
  private readonly runtimeRunId = randomUUID();
  private readonly initialization: Promise<void>;
  private readonly agentService: AgentService;
  private readonly sessionService: SessionService;
  private readonly components: RuntimeSharedComponents;

  constructor(private readonly options: RuntimeCreateOptions) {
    const assembly = new RuntimeAssembly(this.runtimeRunId, options);
    this.storage = assembly.storage;
    this.initialization = assembly.initialization;
    this.agentService = new AgentService(assembly.components, this.initialization);
    this.sessionService = new SessionService(
      options.workdir,
      this.storage,
      assembly.components,
      this.initialization,
    );
    this.components = assembly.components;
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

  async createAgent(type: AgentType): Promise<IAgent> {
    return await this.agentService.createAgent(type);
  }

  async closeAgent(agent: IAgent): Promise<void> {
    await this.agentService.closeAgent(agent);
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
