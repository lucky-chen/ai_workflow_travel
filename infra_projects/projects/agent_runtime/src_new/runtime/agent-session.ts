import { randomUUID } from "node:crypto";

import type {
  AgentRunMode,
  SessionData,
  SessionResult,
  UserInput,
} from "../interface/api.js";
import type { Storage } from "../data/storage.js";
import type {
  AgentSessionLike,
  AgentSessionExecutionContext,
  RuntimeServices,
  RuntimeSessionCreateInput,
  RuntimeSessionConfig,
  StoredSessionState,
} from "./types.js";
import type {
  AgentRuntimeResult,
  AgentSelectionInput,
  AgentSessionState,
  IAgent,
} from "../orchestration/types.js";
import type { AgentContext, TranscriptTurn } from "../context/types.js";

const SESSION_STORAGE_PREFIX = "sessions";

export class AgentSession implements AgentSessionLike {
  private running = false;
  private readonly agentCacheMap = new Map<AgentRunMode, IAgent>();

  private constructor(
    public readonly sessionId: string,
    private readonly storage: Storage,
    private state: StoredSessionState,
    private readonly services: RuntimeServices,
  ) {}

  static async create(
    input: RuntimeSessionCreateInput,
    storage: Storage,
    services: RuntimeServices,
  ): Promise<AgentSession> {
    const now = new Date().toISOString();
    const history = seedHistory(input.sysPrompt, input.userPrompt);
    const state: StoredSessionState = {
      sessionId: input.sessionId,
      title: input.title,
      history,
      config: parseRuntimeSessionConfig(input.config),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const session = new AgentSession(input.sessionId, storage, state, services);
    await services.sessionTranscript.update(input.sessionId, history.map((item) => ({ ...item })));
    await services.runtimeMemory.update(input.sessionId, []);
    await session.persist();
    return session;
  }

  static async open(sessionId: string, storage: Storage, services: RuntimeServices): Promise<AgentSession> {
    const state = await loadStoredSession(storage, sessionId);
    const session = new AgentSession(sessionId, storage, state, services);
    await session.syncHistoryWithTranscript({ persistOnMismatch: true });
    if (state.status === "closed") {
      await session.reopen();
    }
    return session;
  }

  static async loadForClose(sessionId: string, storage: Storage, services: RuntimeServices): Promise<AgentSession> {
    const state = await loadStoredSession(storage, sessionId);
    const session = new AgentSession(sessionId, storage, state, services);
    await session.syncHistoryWithTranscript({ persistOnMismatch: false });
    return session;
  }

  async load(): Promise<SessionData> {
    const transcript = await this.syncHistoryWithTranscript({ persistOnMismatch: false });
    return {
      sessionId: this.state.sessionId,
      history: transcript.turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  async execute(userInput: UserInput): Promise<SessionResult> {
    this.ensureActive();
    this.running = true;
    const traceId = randomUUID();
    try {
      await this.recordRunStarted(traceId);
      const context = await this.assembleContext(userInput, traceId);
      const sessionState = buildAgentSessionState(this.state);
      const routing = await this.services.intentRouter.resolve({
        userInput,
        sessionState,
      });
      const requestedMode = routing.mode;
      const agent = await this.selectAgent(requestedMode, traceId);
      const result = await agent.run(await this.buildAgentContext(context, userInput, requestedMode, sessionState));
      await this.applyStateUpdate(result.stateUpdate, traceId);
      return this.finalizeSuccess(result, requestedMode, agent, traceId);
    } catch (error) {
      return this.finalizeFailure(error, traceId);
    } finally {
      this.running = false;
    }
  }

  async close(): Promise<void> {
    this.state.status = "closed";
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async reopen(): Promise<void> {
    this.state.status = "active";
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
  }

  private ensureActive(): void {
    if (this.state.status === "closed") {
      throw new Error(`Session ${this.sessionId} is closed.`);
    }
  }

  private async persist(): Promise<void> {
    await this.storage.save(sessionStorageKey(this.sessionId), serializeSessionState(this.state));
  }

  private async syncHistoryWithTranscript(
    options: { persistOnMismatch: boolean },
  ): Promise<Awaited<ReturnType<RuntimeServices["sessionTranscript"]["load"]>>> {
    const transcript = await this.services.sessionTranscript.load(this.sessionId);
    const transcriptHistory = transcript.turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
    if (!isSameHistory(this.state.history, transcriptHistory)) {
      this.state.history = transcriptHistory;
      this.state.updatedAt = new Date().toISOString();
      if (options.persistOnMismatch) {
        await this.persist();
      }
    }
    return transcript;
  }

  private async recordRunStarted(traceId: string): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "run_started",
      timestamp: new Date().toISOString(),
      summary: "session run started",
      sessionId: this.sessionId,
    });
  }

  private async assembleContext(userInput: UserInput, traceId: string) {
    await this.recordContextAssembled(traceId);
    return this.services.contextAssembler.assemble({
      sessionId: this.sessionId,
      userInput,
      runtimeLimits: this.state.config?.runtimeLimits,
    });
  }

  private async recordContextAssembled(traceId: string): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "context_assembled",
      timestamp: new Date().toISOString(),
      summary: "context assembled",
      sessionId: this.sessionId,
    });
  }

  private async selectAgent(
    requestedMode: AgentRunMode,
    traceId: string,
  ): Promise<IAgent> {
    await this.recordAgentSelected(traceId, requestedMode);
    const cached = this.agentCacheMap.get(requestedMode);
    if (cached) {
      return cached;
    }
    const agent = await this.services.agentFactory.create(requestedMode);
    this.agentCacheMap.set(requestedMode, agent);
    return agent;
  }

  private async recordAgentSelected(traceId: string, requestedMode: AgentRunMode): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "agent_selected",
      timestamp: new Date().toISOString(),
      summary: `agent selection requested: ${requestedMode}`,
      sessionId: this.sessionId,
    });
  }

  private async buildAgentContext(
    context: Awaited<ReturnType<RuntimeServices["contextAssembler"]["assemble"]>>,
    userInput: UserInput,
    requestedMode: AgentRunMode,
    sessionState: AgentSessionState,
  ): Promise<AgentContext> {
    return {
      ...context,
      runtimeContext: {
        sessionId: this.sessionId,
        userInput,
        requestedMode,
        sessionState,
        modelConfig: await resolveModelConfig(this.state.config, this.services),
        allowedWorkingDirectories: this.state.config?.allowedWorkingDirectories,
      },
    };
  }

  private async applyStateUpdate(
    stateUpdate: AgentRuntimeResult["stateUpdate"],
    traceId: string,
  ): Promise<void> {
    await this.updateTranscript(stateUpdate.transcriptAppend);
    await this.updateRuntimeMemory(stateUpdate.runtimeMemorySummaryItems);
    applyTranscriptToState(this.state, stateUpdate.transcriptAppend);
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
  }

  private async updateTranscript(transcriptAppend: TranscriptTurn[]): Promise<void> {
    const transcriptTurns = await this.services.sessionTranscript.load(this.sessionId);
    const nextTranscript = transcriptTurns.turns.concat(transcriptAppend);
    await this.services.sessionTranscript.update(this.sessionId, nextTranscript);
  }

  private async updateRuntimeMemory(
    runtimeMemorySummaryItems: AgentRuntimeResult["stateUpdate"]["runtimeMemorySummaryItems"],
  ): Promise<void> {
    const runtimeMemory = await this.services.runtimeMemory.load(this.sessionId);
    const nextMemory = runtimeMemory.summaryItems.concat(runtimeMemorySummaryItems);
    await this.services.runtimeMemory.update(this.sessionId, nextMemory);
  }

  private async finalizeSuccess(
    result: AgentRuntimeResult,
    requestedMode: AgentRunMode,
    agent: IAgent,
    traceId: string,
  ): Promise<SessionResult> {
    const normalized = normalizeSessionResult(this.sessionId, traceId, {
      requestedMode,
      result: {
        ...result,
        traceId,
      },
      sessionConfig: this.state.config,
    });
    await this.collectSuccessMetrics(normalized, result, agent.pattern, traceId);
    await this.flushObservability();
    return normalized;
  }

  private async collectSuccessMetrics(
    normalized: SessionResult,
    result: AgentRuntimeResult,
    agentName: IAgent["pattern"],
    traceId: string,
  ): Promise<void> {
    await this.services.metrics.collect({
      sessionId: this.sessionId,
      result: normalized,
      providerUsageFacts: {
        promptTokens: result.agent.tokenUsage?.inputTokens ?? 0,
        completionTokens: result.agent.tokenUsage?.outputTokens ?? 0,
      },
      toolExecutionFacts: result.executionFacts,
      runScope: {
        runId: traceId,
        agentName,
      },
    });
  }

  private async finalizeFailure(error: unknown, traceId: string): Promise<SessionResult> {
    const failure = normalizeFailureSessionResult(this.sessionId, traceId, error);
    await this.services.metrics.collect({
      sessionId: this.sessionId,
      result: failure,
      toolExecutionFacts: {
        toolCalls: 0,
        failedToolCalls: 0,
      },
      runScope: {
        runId: traceId,
        agentName: "session",
      },
    });
    await this.flushObservability();
    return failure;
  }

  private async flushObservability(): Promise<void> {
    await this.services.metrics.flush();
    await this.services.trace.flush();
  }
}

function seedHistory(sysPrompt?: string[], userPrompt?: Record<string, unknown>): SessionData["history"] {
  const history: SessionData["history"] = [];
  for (const prompt of sysPrompt ?? []) {
    history.push({ role: "system", content: prompt });
  }
  if (userPrompt) {
    history.push({ role: "user", content: stringifyContent(userPrompt) });
  }
  return history;
}

function stringifyContent(content: Record<string, unknown>): string {
  return JSON.stringify(content);
}

function sessionStorageKey(sessionId: string): string {
  return `${SESSION_STORAGE_PREFIX}/${sessionId}`;
}

function serializeSessionState(state: StoredSessionState): Record<string, unknown> {
  return {
    sessionId: state.sessionId,
    title: state.title,
    history: state.history,
    config: state.config,
    status: state.status,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

async function loadStoredSession(storage: Storage, sessionId: string): Promise<StoredSessionState> {
  const payload = await storage.load(sessionStorageKey(sessionId));
  if (
    typeof payload.sessionId !== "string" ||
    !Array.isArray(payload.history) ||
    typeof payload.status !== "string" ||
    typeof payload.createdAt !== "string" ||
    typeof payload.updatedAt !== "string"
  ) {
    throw new Error(`Stored session ${sessionId} is invalid.`);
  }

  const history = payload.history.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Stored session ${sessionId} contains invalid history.`);
    }
    const role = Reflect.get(item, "role");
    const content = Reflect.get(item, "content");
    if (
      role !== "user" &&
      role !== "assistant" &&
      role !== "system" &&
      role !== "tool"
    ) {
      throw new Error(`Stored session ${sessionId} contains invalid role.`);
    }
    if (typeof content !== "string") {
      throw new Error(`Stored session ${sessionId} contains invalid content.`);
    }
    return { role, content };
  });

  return {
    sessionId: payload.sessionId,
    title: typeof payload.title === "string" ? payload.title : undefined,
    history,
    config: isRecord(payload.config) ? parseRuntimeSessionConfig(payload.config) : undefined,
    status: payload.status === "closed" ? "closed" : "active",
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildAgentSessionState(state: StoredSessionState): AgentSessionState {
  return {
    sessionId: state.sessionId,
    transcriptTurnCount: state.history.length,
    hasToolHistory: state.history.some((item) => item.role === "tool"),
  };
}

function applyTranscriptToState(state: StoredSessionState, transcriptAppend: TranscriptTurn[]): void {
  state.history.push(...transcriptAppend.map((item) => ({
    role: item.role,
    content: item.content,
  })));
}

function isSameHistory(
  left: StoredSessionState["history"],
  right: StoredSessionState["history"],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item.role === right[index]?.role && item.content === right[index]?.content);
}

function normalizeSessionResult(
  sessionId: string,
  traceId: string,
  context: AgentSessionExecutionContext,
): SessionResult {
  return {
    sessionId,
    traceId,
    content: context.result.content?.data,
    format: context.result.content?.format,
    errorCode: context.result.errorInfo?.code,
    errorMessage: context.result.errorInfo?.message,
  };
}

function normalizeFailureSessionResult(
  sessionId: string,
  traceId: string,
  error: unknown,
): SessionResult {
  return {
    sessionId,
    traceId,
    format: "text",
    errorCode: "SESSION_EXECUTION_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function parseRuntimeSessionConfig(config: unknown): RuntimeSessionConfig | undefined {
  return isRecord(config) ? config as RuntimeSessionConfig : undefined;
}

async function resolveModelConfig(
  config: RuntimeSessionConfig | undefined,
  services: RuntimeServices,
) {
  if (!config?.model) {
    return services.resolveDefaultModelConfig();
  }

  return {
    mock: config?.model?.mock ?? true,
    modeSelection: config?.model?.modeSelection ?? {},
    mockInfo: config?.model?.mockInfo ?? undefined,
  };
}
