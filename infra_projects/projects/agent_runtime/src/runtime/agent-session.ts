import { randomUUID } from "node:crypto";

import type {
  AgentRunMode,
  SessionData,
  SessionResult,
  UserInput,
} from "../interface/api.js";
import type { IAgent } from "../interface/agent-api.js";
import type { Storage } from "../data/storage.js";
import type {
  AgentSessionLike,
  RuntimeComponents,
  RuntimeSessionCreateInput,
  RuntimeSessionConfig,
  StoredSessionState,
} from "./types.js";
import type {
  AgentSelectionInput,
} from "../orchestration/types.js";
import type { AssembledContext } from "../context/types.js";
import type { AgentRunResult } from "../interface/agent-api.js";

const SESSION_STORAGE_PREFIX = "sessions";

export class AgentSession implements AgentSessionLike {
  private running = false;
  private readonly agentCacheMap = new Map<AgentRunMode, IAgent>();

  private constructor(
    public readonly sessionId: string,
    private readonly storage: Storage,
    private state: StoredSessionState,
    private readonly components: RuntimeComponents,
  ) {}

  static async create(
    input: RuntimeSessionCreateInput,
    storage: Storage,
    components: RuntimeComponents,
  ): Promise<AgentSession> {
    const now = new Date().toISOString();
    const history = seedHistory(input.sysPrompt, input.userPrompt);
    const state: StoredSessionState = {
      sessionId: input.sessionId,
      title: input.title,
      systemPrompt: input.sysPrompt,
      history,
      config: parseRuntimeSessionConfig(input.config),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const session = new AgentSession(input.sessionId, storage, state, components);
    await components.sessionTranscript.update(input.sessionId, history.map((item) => ({ ...item })));
    await components.runtimeMemory.update(input.sessionId, []);
    await session.persist();
    await components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_created",
        sessionId: input.sessionId,
        timestamp: new Date().toISOString(),
        session: {
          mode: "create",
        },
      },
    });
    return session;
  }

  static async open(sessionId: string, storage: Storage, components: RuntimeComponents): Promise<AgentSession> {
    const state = await loadStoredSession(storage, sessionId);
    const session = new AgentSession(sessionId, storage, state, components);
    await session.syncHistoryWithTranscript({ persistOnMismatch: true });
    if (state.status === "closed") {
      await session.reopen();
    }
    await components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_opened",
        sessionId,
        timestamp: new Date().toISOString(),
        session: {
          mode: "open",
        },
      },
    });
    return session;
  }

  static async loadForClose(sessionId: string, storage: Storage, components: RuntimeComponents): Promise<AgentSession> {
    const state = await loadStoredSession(storage, sessionId);
    const session = new AgentSession(sessionId, storage, state, components);
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
      const routing = await this.components.intentRouter.resolve({
        userInput,
      });
      const requestedMode = routing.mode;
      const agent = await this.selectAgent(requestedMode);
      const result = await agent.run(await this.buildAgentRunInput(context, userInput, requestedMode));
      return this.finalizeSuccess(userInput, result, requestedMode, traceId);
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
  ): Promise<Awaited<ReturnType<RuntimeComponents["sessionTranscript"]["load"]>>> {
    const transcript = await this.components.sessionTranscript.load(this.sessionId);
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
    await this.components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "run_started",
        sessionId: this.sessionId,
        traceId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async assembleContext(userInput: UserInput, traceId: string) {
    await this.recordContextAssembled(traceId);
    return this.components.contextAssembler.assemble({
      sessionId: this.sessionId,
      userInput,
      runtimeLimits: this.state.config?.runtimeLimits,
    });
  }

  private async recordContextAssembled(traceId: string): Promise<void> {
    await this.components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "context_assembled",
        sessionId: this.sessionId,
        traceId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async selectAgent(requestedMode: AgentRunMode): Promise<IAgent> {
    const cached = this.agentCacheMap.get(requestedMode);
    if (cached) {
      return cached;
    }
    const agent = await this.components.agentFactory.create(requestedMode, {
      modelConfig: this.state.config?.model,
    });
    this.agentCacheMap.set(requestedMode, agent);
    return agent;
  }

  private async buildAgentRunInput(
    context: AssembledContext,
    userInput: UserInput,
    requestedMode: AgentRunMode,
  ) {
    return {
      userInput: userInput.content,
      context: {
        requestedMode,
      },
    };
  }

  private async finalizeSuccess(
    userInput: UserInput,
    result: AgentRunResult,
    requestedMode: AgentRunMode,
    traceId: string,
  ): Promise<SessionResult> {
    const normalized = normalizeSessionResult(this.sessionId, traceId, result);
    await this.persistTranscript(userInput, normalized);
    await this.collectSuccessMetrics(normalized, result, requestedMode, traceId);
    await this.components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "run_finished",
        sessionId: this.sessionId,
        traceId,
        timestamp: new Date().toISOString(),
        custom: {
          agent: requestedMode,
          format: normalized.format,
          hasError: Boolean(normalized.errorCode),
        },
      },
    });
    await this.flushObservability();
    return normalized;
  }

  private async collectSuccessMetrics(
    normalized: SessionResult,
    result: AgentRunResult,
    agentName: AgentRunMode,
    traceId: string,
  ): Promise<void> {
    await this.components.metrics.collect({
      sessionId: this.sessionId,
      result: normalized,
      providerUsageFacts: {
        promptTokens: result.tokenUsage?.inputTokens ?? 0,
        completionTokens: result.tokenUsage?.outputTokens ?? 0,
      },
      runScope: {
        runId: traceId,
        agentName,
      },
    });
  }

  private async finalizeFailure(error: unknown, traceId: string): Promise<SessionResult> {
    const failure = normalizeFailureSessionResult(this.sessionId, traceId, error);
    await this.components.metrics.collect({
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
    await this.components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "run_failed",
        sessionId: this.sessionId,
        traceId,
        timestamp: new Date().toISOString(),
        custom: {
          error: {
            code: failure.errorCode ?? "SESSION_EXECUTION_FAILED",
            message: failure.errorMessage ?? "Session execution failed.",
          },
        },
      },
    });
    await this.flushObservability();
    return failure;
  }

  private async flushObservability(): Promise<void> {
    await this.components.metrics.flush();
    await this.components.trace.flush();
  }

  private async persistTranscript(userInput: UserInput, result: SessionResult): Promise<void> {
    const transcript = await this.components.sessionTranscript.load(this.sessionId);
    const turns = [
      ...transcript.turns,
      {
        role: "user" as const,
        content: stringifyContent(userInput.content),
      },
    ];
    if (!result.errorCode && result.content !== undefined) {
      turns.push({
        role: "assistant" as const,
        content: stringifyResultContent(result.content),
      });
    }
    await this.components.sessionTranscript.update(this.sessionId, turns);
    this.state.history = turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
    await this.components.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "state_persisted",
        sessionId: this.sessionId,
        traceId: result.traceId,
        timestamp: new Date().toISOString(),
      },
    });
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

function stringifyResultContent(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function sessionStorageKey(sessionId: string): string {
  return `${SESSION_STORAGE_PREFIX}/${sessionId}`;
}

function serializeSessionState(state: StoredSessionState): Record<string, unknown> {
  return {
    sessionId: state.sessionId,
    title: state.title,
    systemPrompt: state.systemPrompt,
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
    systemPrompt: Array.isArray(payload.systemPrompt)
      ? payload.systemPrompt.filter((item): item is string => typeof item === "string")
      : history
        .filter((item) => item.role === "system")
        .map((item) => item.content),
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
  result: { content?: unknown; format?: unknown; errorInfo?: unknown },
): SessionResult {
  const errorInfo = isRecord(result.errorInfo) ? result.errorInfo : undefined;
  return {
    sessionId,
    traceId,
    content: typeof result.content === "string" || isRecord(result.content) ? result.content : undefined,
    format: result.format === "json" ? "json" : result.format === "text" ? "text" : undefined,
    errorCode: typeof errorInfo?.code === "string" ? errorInfo.code : undefined,
    errorMessage: typeof errorInfo?.message === "string" ? errorInfo.message : undefined,
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
