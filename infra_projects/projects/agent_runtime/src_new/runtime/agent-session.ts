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
    const requestedMode = normalizeRequestedMode(userInput.mode);
    const runId = randomUUID();
    const traceId = randomUUID();
    try {
      await this.recordRunStarted(traceId, runId);
      const context = await this.assembleContext(userInput, traceId, runId);
      const sessionState = buildAgentSessionState(this.state);
      const agent = await this.selectAgent(userInput, requestedMode, sessionState, traceId, runId);
      const result = await agent.run(await this.buildAgentContext(context, userInput, requestedMode, sessionState));
      await this.applyStateUpdate(result.stateUpdate, traceId, runId);
      return this.finalizeSuccess(result, requestedMode, agent, traceId, runId);
    } catch (error) {
      return this.finalizeFailure(error, traceId, runId);
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

  private async recordRunStarted(traceId: string, runId: string): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "run_started",
      timestamp: new Date().toISOString(),
      caller: "AgentSession",
      summary: "session run started",
      sessionId: this.sessionId,
      runId,
    });
  }

  private async assembleContext(userInput: UserInput, traceId: string, runId: string) {
    const context = await this.services.contextAssembler.assemble({
      sessionId: this.sessionId,
      userInput,
      runtimeLimits: this.state.config?.runtimeLimits,
    });
    await this.recordContextAssembled(traceId, runId);
    return context;
  }

  private async recordContextAssembled(traceId: string, runId: string): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "context_assembled",
      timestamp: new Date().toISOString(),
      caller: "AgentSession",
      summary: "context assembled",
      sessionId: this.sessionId,
      runId,
    });
  }

  private async selectAgent(
    userInput: UserInput,
    requestedMode: AgentRunMode,
    sessionState: AgentSessionState,
    traceId: string,
    runId: string,
  ): Promise<IAgent> {
    const selectionInput: AgentSelectionInput = {
      userInput,
      sessionState,
      requestedMode,
    };
    const agent = await this.services.agentSelector.select(selectionInput);
    await this.recordAgentSelected(traceId, runId, agent.pattern);
    return agent;
  }

  private async recordAgentSelected(traceId: string, runId: string, pattern: IAgent["pattern"]): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "agent_selected",
      timestamp: new Date().toISOString(),
      caller: "AgentSession",
      summary: `agent selected: ${pattern}`,
      sessionId: this.sessionId,
      runId,
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
    runId: string,
  ): Promise<void> {
    await this.updateTranscript(stateUpdate.transcriptAppend);
    await this.updateRuntimeMemory(stateUpdate.runtimeMemorySummaryItems);
    applyTranscriptToState(this.state, stateUpdate.transcriptAppend);
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
    await this.recordStatePersisted(traceId, runId);
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

  private async recordStatePersisted(traceId: string, runId: string): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "state_persisted",
      timestamp: new Date().toISOString(),
      caller: "AgentSession",
      summary: "session state persisted",
      sessionId: this.sessionId,
      runId,
    });
  }

  private async finalizeSuccess(
    result: AgentRuntimeResult,
    requestedMode: AgentRunMode,
    agent: IAgent,
    traceId: string,
    runId: string,
  ): Promise<SessionResult> {
    const normalized = normalizeSessionResult(this.sessionId, traceId, {
      requestedMode,
      result: {
        ...result,
        runId,
        traceId,
      },
      sessionConfig: this.state.config,
    });
    await this.collectSuccessMetrics(normalized, result, agent.pattern, runId);
    await this.recordRunFinished(traceId, runId, normalized);
    await this.flushObservability();
    return normalized;
  }

  private async collectSuccessMetrics(
    normalized: SessionResult,
    result: AgentRuntimeResult,
    agentName: IAgent["pattern"],
    runId: string,
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
        runId,
        agentName,
      },
    });
  }

  private async recordRunFinished(traceId: string, runId: string, result: SessionResult): Promise<void> {
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: result.errorCode ? "run_failed" : "run_finished",
      timestamp: new Date().toISOString(),
      caller: "AgentSession",
      summary: result.errorCode ? result.errorMessage ?? "run failed" : "run finished",
      sessionId: this.sessionId,
      runId,
    });
  }

  private async finalizeFailure(error: unknown, traceId: string, runId: string): Promise<SessionResult> {
    const failure = normalizeFailureSessionResult(this.sessionId, runId, traceId, error);
    await this.services.metrics.collect({
      sessionId: this.sessionId,
      result: failure,
      toolExecutionFacts: {
        toolCalls: 0,
        failedToolCalls: 0,
      },
      runScope: {
        runId,
        agentName: "session",
      },
    });
    await this.services.trace.record({
      traceId,
      scope: "session",
      eventType: "run_failed",
      timestamp: new Date().toISOString(),
      caller: "AgentSession",
      summary: failure.errorMessage ?? "run failed",
      sessionId: this.sessionId,
      runId,
      diagnostics: failure.errorCode
        ? [{ code: failure.errorCode, message: failure.errorMessage ?? failure.errorCode }]
        : undefined,
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

function normalizeRequestedMode(mode?: AgentRunMode): AgentRunMode {
  return mode ?? "dynamic";
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
    runId: context.result.runId,
    traceId,
    content: context.result.content?.data,
    format: context.result.content?.format,
    errorCode: context.result.errorInfo?.code,
    errorMessage: context.result.errorInfo?.message,
  };
}

function normalizeFailureSessionResult(
  sessionId: string,
  runId: string,
  traceId: string,
  error: unknown,
): SessionResult {
  return {
    sessionId,
    runId,
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
