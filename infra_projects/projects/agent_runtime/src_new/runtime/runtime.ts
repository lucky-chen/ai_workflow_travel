import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  RuntimeApi,
} from "../interface/api.js";
import { FileStorage, type Storage } from "../data/storage.js";
import { AgentSession } from "./agent-session.js";
import { AgentSessionManager } from "./agent-session-manager.js";

export interface RuntimeOptions {
  workdir: string;
}

export class Runtime implements RuntimeApi {
  private readonly storage: Storage;
  private readonly sessionManager = new AgentSessionManager();

  constructor(private readonly options: RuntimeOptions) {
    if (!options.workdir) {
      throw new Error("Runtime requires workdir.");
    }
    this.storage = new FileStorage(path.join(options.workdir, ".agent_runtime"));
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    const sessionId = randomUUID();
    const session = await AgentSession.create({ ...input, sessionId }, this.storage);
    await this.sessionManager.put(sessionId, session);
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    const cached = await this.sessionManager.get(sessionId);
    if (cached instanceof AgentSession) {
      return cached;
    }
    const session = await AgentSession.open(sessionId, this.storage);
    await this.sessionManager.put(sessionId, session);
    return session;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    const session = await this.openSession(sessionId);
    await session.close();
    await this.sessionManager.remove(sessionId);
    return { sessionId };
  }
}

export function createRuntime(options: RuntimeOptions): Runtime {
  return new Runtime(options);
}

