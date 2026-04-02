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
  private readonly agentService: AgentService;
  private readonly sessionService: SessionService;
  private readonly agentComponents: RuntimeSharedComponents;
  private readonly sessionComponents: RuntimeSharedComponents;
  private readonly sessionStorage: Storage;

  constructor(private readonly options: RuntimeCreateOptions) {
    const agentAssembly = new RuntimeAssembly(randomUUID(), {
      ...options,
      serviceScope: "agent_service",
    });
    const sessionAssembly = new RuntimeAssembly(randomUUID(), {
      ...options,
      serviceScope: "session_service",
    });
    this.agentComponents = agentAssembly.components;
    this.sessionComponents = sessionAssembly.components;
    this.sessionStorage = sessionAssembly.storage;
    this.agentService = new AgentService(agentAssembly.components, agentAssembly.initialization);
    this.sessionService = new SessionService(
      options.workdir,
      this.sessionStorage,
      sessionAssembly.components,
      sessionAssembly.initialization,
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

  async createAgent(type: AgentType): Promise<IAgent> {
    return await this.agentService.createAgent(type);
  }

  async closeAgent(agent: IAgent): Promise<void> {
    await this.agentService.closeAgent(agent);
  }

  subscribeEvents(listener: RuntimeEventListener): void {
    this.agentComponents.eventBus.subscribe(listener);
    this.sessionComponents.eventBus.subscribe(listener);
  }

  unsubscribeEvents(listener: RuntimeEventListener): void {
    this.agentComponents.eventBus.unsubscribe(listener);
    this.sessionComponents.eventBus.unsubscribe(listener);
  }
}

export function createRuntime(options: RuntimeCreateOptions): Runtime {
  return new Runtime(options);
}
