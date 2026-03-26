import type {
  AgentSessionCreateInput,
  AgentSessionOpenInput,
  AgentSessionRequest,
  AgentSessionState,
  IAgentTraceRecorder,
  MessageTurn,
  RequestMetadata,
  SdkTraceEvent,
} from "./agent-runtime-types.js";

export class AgentSessionManager {
  private readonly sessions = new Map<string, AgentSessionState>();

  constructor(private readonly traceRecorder?: IAgentTraceRecorder) {}

  async createSession(input: AgentSessionCreateInput): Promise<AgentSessionState> {
    await this.recordRequestedEvent("session_create_requested", input.metadata);

    const session: AgentSessionState = {
      sessionId: createSessionId(),
      title: input.title,
      createdAt: new Date().toISOString(),
      status: "active",
      transcript: createInitialTranscript(input),
      metadata: input.metadata,
    };
    this.sessions.set(session.sessionId, session);

    await this.recordLifecycleEvent("session_created", session.sessionId, input.metadata);
    return cloneSessionState(session);
  }

  async openSession(input: AgentSessionOpenInput, metadata?: RequestMetadata): Promise<AgentSessionState> {
    await this.recordRequestedEvent("session_open_requested", metadata, input.sessionId);

    const session = this.getSessionOrThrow(input.sessionId);

    await this.recordLifecycleEvent("session_opened", session.sessionId, metadata ?? session.metadata);
    return cloneSessionState(session);
  }

  async readSession(sessionId: string): Promise<AgentSessionState> {
    return cloneSessionState(this.getSessionOrThrow(sessionId));
  }

  async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "closed") {
      return false;
    }

    session.status = "closed";
    await this.recordLifecycleEvent("session_closed", sessionId, session.metadata);
    return true;
  }

  async attachRequest(sessionId: string, request: AgentSessionRequest): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);

    if (!session.initialRequest) {
      session.initialRequest = cloneRequest(request);
    }
  }

  async appendTranscript(sessionId: string, turns: MessageTurn[]): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);

    session.transcript.push(...turns.map((turn) => ({ ...turn })));
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  isClosed(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.status === "closed";
  }

  private async recordRequestedEvent(
    eventType: "session_create_requested" | "session_open_requested",
    metadata?: RequestMetadata,
    sessionId?: string,
  ): Promise<void> {
    await this.traceRecorder?.record({
      scope: "sdk",
      eventType,
      traceId: resolveTraceId(metadata),
      timestamp: new Date().toISOString(),
      caller: "AgentSessionManager",
      summary: `${eventType.replaceAll("_", " ")}.`,
      ...(sessionId ? { sessionId } : {}),
    });
  }

  private async recordLifecycleEvent(
    eventType: "session_created" | "session_opened" | "session_closed",
    sessionId: string,
    metadata?: RequestMetadata,
  ): Promise<void> {
    const event: SdkTraceEvent = {
      scope: "sdk",
      eventType,
      sessionId,
      traceId: resolveTraceId(metadata),
      timestamp: new Date().toISOString(),
      caller: "AgentSessionManager",
      summary: `${eventType.replaceAll("_", " ")}.`,
    };
    await this.traceRecorder?.record(event);
  }

  private getSessionOrThrow(sessionId: string): AgentSessionState {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
}

function createInitialTranscript(input: AgentSessionCreateInput) {
  const transcript = [];
  if (Array.isArray(input.initialSystemPrompt) && input.initialSystemPrompt.length > 0) {
    transcript.push({
      role: "system" as const,
      content: input.initialSystemPrompt.join("\n"),
    });
  }
  if (input.initialUserPrompt) {
    transcript.push({
      role: "user" as const,
      content: JSON.stringify(input.initialUserPrompt),
    });
  }
  return transcript;
}

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveTraceId(metadata?: RequestMetadata): string {
  return metadata?.traceId?.trim() || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneSessionState(state: AgentSessionState): AgentSessionState {
  return {
    ...state,
    initialRequest: state.initialRequest ? cloneRequest(state.initialRequest) : undefined,
    transcript: state.transcript.map((turn) => ({ ...turn })),
    metadata: state.metadata ? { ...state.metadata, labels: state.metadata.labels ? { ...state.metadata.labels } : undefined } : undefined,
  };
}

function cloneRequest(request: AgentSessionRequest): AgentSessionRequest {
  return {
    payload: {
      ...request.payload,
      prompt: {
        systemPrompt: [...request.payload.prompt.systemPrompt],
        userPrompt: { ...request.payload.prompt.userPrompt },
      },
      mcpToolCalls: request.payload.mcpToolCalls?.map((toolCall) => ({
        toolName: toolCall.toolName,
        arguments: { ...toolCall.arguments },
      })),
    },
    metadata: request.metadata ? { ...request.metadata, labels: request.metadata.labels ? { ...request.metadata.labels } : undefined } : undefined,
  };
}
