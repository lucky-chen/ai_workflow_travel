import { ContextAssembler } from "../context/context-assembler.js";
import { DefaultRetrievalProvider } from "../context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../context/runtime-memory-store.js";
import { SessionHistoryStore } from "../context/session-history-store.js";
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
  private readonly historyStore: SessionHistoryStore;
  private readonly memoryStore: RuntimeMemoryStore;
  private readonly contextAssembler: ContextAssembler;

  constructor(private readonly dependencies: AgentRuntimeDependencies) {
    this.historyStore = new SessionHistoryStore();
    this.memoryStore = new RuntimeMemoryStore();
    this.sessionManager = new AgentSessionManager(dependencies.traceRecorder, this.historyStore);
    this.contextAssembler = new ContextAssembler(
      this.historyStore,
      this.memoryStore,
      new DefaultRetrievalProvider(),
      dependencies.workdir,
    );
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
    const session = await this.sessionManager.readSession(sessionId);
    if (this.sessionManager.isClosed(sessionId)) {
      throw new Error(`Session is closed: ${sessionId}`);
    }

    await this.sessionManager.attachRequest(sessionId, request);
    const context = await this.contextAssembler.assemble(session, request);
    await this.sessionManager.appendTranscript(sessionId, [
      {
        role: "user",
        content: JSON.stringify(request.payload.prompt.userPrompt),
      },
      {
        role: "assistant",
        content: "Session execution is not implemented yet.",
      },
    ]);

    return {
      status: "failed",
      payload: {
        history: context.runtimeContext.history,
        memory: context.runtimeContext.memory,
        retrievalContext: context.runtimeContext.retrievalContext,
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
