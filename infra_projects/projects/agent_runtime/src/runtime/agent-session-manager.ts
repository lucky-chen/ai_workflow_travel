import type { AgentSessionLike } from "./types.js";

export class AgentSessionManager {
  private readonly sessions = new Map<string, AgentSessionLike>();

  async put(sessionId: string, session: AgentSessionLike): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async get(sessionId: string): Promise<AgentSessionLike | undefined> {
    return this.sessions.get(sessionId);
  }

  async remove(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

