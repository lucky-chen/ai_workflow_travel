import {
  AgentSessionManager,
} from "./agent-session-manager.js";
import { RuntimeAgentSession } from "./runtime-agent-session.js";
import type {
  AgentRuntime,
  AgentRuntimeDependencies,
  AgentRuntimeResult,
  AgentSession,
  AgentSessionCreateInput,
  AgentSessionOpenInput,
  AgentSessionRequest,
  AgentSessionState,
} from "./agent-runtime-types.js";

export class AgentRuntimeService implements AgentRuntime {
  private readonly sessionManager: AgentSessionManager;

  constructor(private readonly dependencies: AgentRuntimeDependencies) {
    this.sessionManager = new AgentSessionManager(dependencies.traceRecorder);
  }

  async createSession(input: AgentSessionCreateInput): Promise<AgentSession> {
    const session = await this.sessionManager.createSession(input);
    return new RuntimeAgentSession(this, session.sessionId);
  }

  async openSession(input: AgentSessionOpenInput): Promise<AgentSession> {
    const session = await this.sessionManager.openSession(input);
    return new RuntimeAgentSession(this, session.sessionId);
  }

  closeSession(sessionId: string): Promise<boolean> {
    return this.sessionManager.closeSession(sessionId);
  }

  async execute(sessionId: string, request: AgentSessionRequest): Promise<AgentRuntimeResult> {
    if (!this.sessionManager.hasSession(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      status: "failed",
      payload: {
        summary: "Session execution is not implemented yet.",
      },
      diagnostics: [
        {
          code: "session_execution_not_implemented",
          message: "Session execution will be implemented in a later task.",
          severity: "medium",
        },
      ],
    };
  }

  readSession(sessionId: string): Promise<AgentSessionState> {
    return this.sessionManager.readSession(sessionId);
  }

  getWorkdir(): string {
    return this.dependencies.workdir;
  }
}
