import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { SessionHistoryStore } from "../context/session-history-store.js";
import type {
  AgentSessionCreateInput,
  AgentSessionOpenInput,
  AgentSessionRequest,
  AgentSessionState,
  IAgentTraceRecorder,
  MemoryEntry,
  MessageTurn,
  RequestMetadata,
  SdkTraceEvent,
  TokenUsageSummary,
} from "./agent-runtime-types.js";
import { resolveSessionStatePath } from "./runtime-storage-paths.js";

interface PersistedSessionState extends Omit<AgentSessionState, "transcript"> {}

export class AgentSessionManager {
  constructor(
    private readonly workdir: string,
    private readonly traceRecorder?: IAgentTraceRecorder,
    private readonly historyStore: SessionHistoryStore = new SessionHistoryStore(workdir),
  ) {}

  async createSession(input: AgentSessionCreateInput): Promise<AgentSessionState> {
    await this.recordRequestedEvent("session_create_requested", input.metadata);

    const transcript = createInitialTranscript(input);
    const session: AgentSessionState = {
      sessionId: createSessionId(),
      title: input.title,
      createdAt: new Date().toISOString(),
      status: "active",
      transcript,
      metadata: input.metadata,
    };
    await this.writeState(session);
    await this.historyStore.initialize(session.sessionId, transcript);

    await this.recordLifecycleEvent("session_created", session.sessionId, input.metadata);
    return cloneSessionState(session);
  }

  async openSession(input: AgentSessionOpenInput, metadata?: RequestMetadata): Promise<AgentSessionState> {
    await this.recordRequestedEvent("session_open_requested", metadata, input.sessionId);

    const session = await this.getSessionOrThrow(input.sessionId);
    session.status = "active";
    await this.writeState(session);

    await this.recordLifecycleEvent("session_opened", session.sessionId, metadata ?? session.metadata);
    return cloneSessionState(session);
  }

  async readSession(sessionId: string): Promise<AgentSessionState> {
    const session = await this.getSessionOrThrow(sessionId);
    const transcript = await this.historyStore.load(sessionId);
    return cloneSessionState({
      ...session,
      transcript,
    });
  }

  async closeSession(
    sessionId: string,
    closedMemorySummary?: MemoryEntry[],
    usageSummary?: TokenUsageSummary,
  ): Promise<boolean> {
    const session = await this.tryGetSession(sessionId);
    if (!session || session.status === "closed") {
      return false;
    }

    session.status = "closed";
    session.closedMemorySummary = closedMemorySummary?.map((entry) => ({ ...entry })) ?? session.closedMemorySummary;
    session.usageSummary = usageSummary ?? session.usageSummary;
    await this.writeState(session);
    await this.recordLifecycleEvent("session_closed", sessionId, session.metadata);
    return true;
  }

  async attachRequest(sessionId: string, request: AgentSessionRequest): Promise<void> {
    const session = await this.getSessionOrThrow(sessionId);

    if (!session.initialRequest) {
      session.initialRequest = cloneRequest(request);
    }
    session.lastMemoryScope = request.payload.memoryScope;
    await this.writeState(session);
  }

  async appendTranscript(sessionId: string, turns: MessageTurn[]): Promise<void> {
    const session = await this.getSessionOrThrow(sessionId);
    await this.historyStore.append(sessionId, turns);
    session.transcript = await this.historyStore.load(sessionId);
    await this.writeState(session);
  }

  async updateStatus(sessionId: string, status: AgentSessionState["status"]): Promise<void> {
    const session = await this.getSessionOrThrow(sessionId);
    session.status = status;
    await this.writeState(session);
  }

  resolveSessionStatePath(sessionId: string): string {
    return resolveSessionStatePath(this.workdir, sessionId);
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

  private async tryGetSession(sessionId: string): Promise<AgentSessionState | undefined> {
    const statePath = this.resolveSessionStatePath(sessionId);
    let raw: string;

    try {
      raw = await readFile(statePath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }

    const persisted = JSON.parse(raw) as PersistedSessionState;
    return {
      ...persisted,
      transcript: [],
      metadata: persisted.metadata
        ? { ...persisted.metadata, labels: persisted.metadata.labels ? { ...persisted.metadata.labels } : undefined }
        : undefined,
    };
  }

  private async getSessionOrThrow(sessionId: string): Promise<AgentSessionState> {
    const session = await this.tryGetSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  private async writeState(session: AgentSessionState): Promise<void> {
    const statePath = this.resolveSessionStatePath(session.sessionId);
    const persisted: PersistedSessionState = {
      sessionId: session.sessionId,
      title: session.title,
      createdAt: session.createdAt,
      status: session.status,
      initialRequest: session.initialRequest ? cloneRequest(session.initialRequest) : undefined,
      lastMemoryScope: session.lastMemoryScope,
      closedMemorySummary: session.closedMemorySummary?.map((entry) => ({ ...entry })),
      usageSummary: session.usageSummary ? { ...session.usageSummary } : undefined,
      metadata: session.metadata ? { ...session.metadata, labels: session.metadata.labels ? { ...session.metadata.labels } : undefined } : undefined,
    };
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
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
    lastMemoryScope: state.lastMemoryScope,
    closedMemorySummary: state.closedMemorySummary?.map((entry) => ({ ...entry })),
    usageSummary: state.usageSummary ? { ...state.usageSummary } : undefined,
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
