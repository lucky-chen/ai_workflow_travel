import { ContextAssembler } from "../context/context-assembler.js";
import { DefaultRetrievalProvider } from "../context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../context/runtime-memory-store.js";
import { SessionTranscriptStore } from "../context/session-transcript-store.js";
import { ExecutionPromptBuilder } from "../loop/execution-prompt-builder.js";
import { ExecutionResultValidator } from "../loop/execution-result-validator.js";
import { ObservationValidator } from "../loop/observation-validator.js";
import { PlanValidator } from "../loop/plan-validator.js";
import { PlanningPromptBuilder } from "../loop/planning-prompt-builder.js";
import { ResultNormalizer } from "../loop/result-normalizer.js";
import { DefaultMcpGateway } from "../mcp/default-mcp-gateway.js";
import { ExecutionStrategySelector } from "../model/execution-strategy-selector.js";
import { FileAgentTraceRecorder } from "./file-agent-trace-recorder.js";
import {
  AgentSessionManager,
} from "./agent-session-manager.js";
import { AgentTraceApi } from "./agent-trace-api.js";
import { DefaultAgent } from "./default-agent.js";
import { DefaultExecutor } from "./default-executor.js";
import { DefaultObserver } from "./default-observer.js";
import { DefaultPlanner } from "./default-planner.js";
import { RuntimeMetricsCollector } from "./runtime-metrics-collector.js";
import { RuntimeAgentSession } from "./runtime-agent-session.js";
import { createRuntimeTraceFileId, resolveRuntimeTracePath } from "./runtime-storage-paths.js";
import { createEmptyTokenUsageSummary } from "./agent-runtime-types.js";
import type {
  AgentRuntime,
  CloseSessionResult,
  AgentRuntimeDependencies,
  AgentRuntimeResult,
  AgentContext,
  AgentSession,
  AgentSessionCreateInput,
  AgentSessionOpenInput,
  AgentSessionRequest,
  AgentSessionState,
} from "./agent-runtime-types.js";

export class AgentRuntimeService implements AgentRuntime {
  private readonly sessionManager: AgentSessionManager;
  private readonly transcriptStore: SessionTranscriptStore;
  private readonly memoryStore: RuntimeMemoryStore;
  private readonly contextAssembler: ContextAssembler;
  private readonly traceRecorder;
  private readonly traceApi: AgentTraceApi;
  private readonly metricsCollector = new RuntimeMetricsCollector();
  private readonly resultNormalizer = new ResultNormalizer();

  constructor(private readonly dependencies: AgentRuntimeDependencies) {
    const traceFileId = dependencies.traceFileId ?? createRuntimeTraceFileId();
    this.traceRecorder = dependencies.traceRecorder
      ?? new FileAgentTraceRecorder(resolveRuntimeTracePath(dependencies.workdir, traceFileId));
    this.traceApi = new AgentTraceApi(this.traceRecorder);
    this.transcriptStore = new SessionTranscriptStore(dependencies.workdir);
    this.memoryStore = new RuntimeMemoryStore(dependencies.workdir);
    this.sessionManager = new AgentSessionManager(dependencies.workdir, this.traceRecorder, this.transcriptStore);
    this.contextAssembler = new ContextAssembler(
      this.transcriptStore,
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

  closeSession(sessionId: string): Promise<CloseSessionResult> {
    return this.closeSessionWithSummary(sessionId);
  }

  async execute(sessionId: string, request: AgentSessionRequest): Promise<AgentRuntimeResult> {
    const context = await this.prepareExecutionContext(sessionId, request);
    const agent = this.createAgent();
    let result: AgentRuntimeResult;
    try {
      result = await agent.run(context);
    } catch (error) {
      await this.sessionManager.updateStatus(sessionId, "failed");
      throw error;
    }

    await this.writeExecutionOutputs(sessionId, request, result);
    await this.saveRuntimeMemorySummary(sessionId, request, result);
    const updatedSession = await this.sessionManager.readSession(sessionId);

    return this.normalizeExecutionResult(result, context, updatedSession.transcript);
  }

  readSession(sessionId: string): Promise<AgentSessionState> {
    return this.sessionManager.readSession(sessionId);
  }

  getWorkdir(): string {
    return this.dependencies.workdir;
  }

  private async prepareExecutionContext(
    sessionId: string,
    request: AgentSessionRequest,
  ): Promise<AgentContext> {
    const runId = createRunId();
    const session = await this.sessionManager.readSession(sessionId);
    this.assertSessionIsWritable(sessionId, session.status);
    await this.sessionManager.attachRequest(sessionId, request);
    const context = await this.contextAssembler.assemble(session, request);
    return {
      ...context,
      runtimeContext: {
        ...context.runtimeContext,
        runId,
      },
    };
  }

  private assertSessionIsWritable(sessionId: string, status: AgentSessionState["status"]): void {
    if (status === "closed") {
      throw new Error(`Session is closed: ${sessionId}`);
    }
  }

  private createAgent(): DefaultAgent {
    const strategy = this.selectExecutionStrategy();
    const mcpGateway = new DefaultMcpGateway();
    const availableTools = mcpGateway.listToolNames();

    return new DefaultAgent(
      new DefaultPlanner(strategy.executor, availableTools, new PlanningPromptBuilder()),
      new PlanValidator(availableTools),
      new DefaultExecutor(strategy.executor, mcpGateway, new ExecutionPromptBuilder()),
      new ExecutionResultValidator(),
      new DefaultObserver(),
      new ObservationValidator(),
      this.traceApi,
    );
  }

  private selectExecutionStrategy() {
    return new ExecutionStrategySelector().select({
      mode: this.dependencies.mode,
      realProvider: this.dependencies.realProvider,
      mockContent: this.dependencies.mockContent,
      mockExecute: this.dependencies.mockExecute,
    });
  }

  private async closeSessionWithSummary(sessionId: string): Promise<CloseSessionResult> {
    const session = await this.sessionManager.readSession(sessionId).catch((error: unknown) => {
      if (error instanceof Error && error.message.startsWith("Session not found:")) {
        return undefined;
      }
      throw error;
    });
    if (!session) {
      return {
        sessionId,
        closed: false,
        usageSummary: this.traceRecorder.summarizeSessionUsage?.(sessionId) ?? createEmptyTokenUsageSummary(),
      };
    }

    const closedMemorySummary = await this.memoryStore.load(sessionId);
    const usageSummary = this.traceRecorder.summarizeSessionUsage?.(sessionId) ?? createEmptyTokenUsageSummary();
    const closed = await this.sessionManager.closeSession(sessionId, closedMemorySummary, usageSummary);
    await this.memoryStore.flush(sessionId);
    await this.traceRecorder.flush?.();
    return {
      sessionId,
      closed,
      usageSummary,
    };
  }

  private async writeExecutionOutputs(
    sessionId: string,
    request: AgentSessionRequest,
    result: AgentRuntimeResult,
  ): Promise<void> {
    await this.sessionManager.appendTranscript(sessionId, this.buildTranscriptTurns(request, result));
    await this.transcriptStore.flush(sessionId);
    await this.sessionManager.updateStatus(sessionId, result.status === "success" ? "completed" : "failed");
  }

  private buildTranscriptTurns(request: AgentSessionRequest, result: AgentRuntimeResult) {
    return [
      {
        role: "user" as const,
        content: JSON.stringify(request.payload.prompt.userPrompt),
      },
      ...(result.payload.toolResults ?? []).map((toolResult) => ({
        role: "tool" as const,
        content: toolResult.content,
      })),
      {
        role: "assistant" as const,
        content: result.payload.content ?? result.payload.summary ?? "",
      },
    ];
  }

  private normalizeExecutionResult(
    result: AgentRuntimeResult,
    context: AgentContext,
    transcript: AgentContext["runtimeContext"]["transcript"],
  ): AgentRuntimeResult {
    return this.resultNormalizer.normalize(
      result,
      {
        ...context,
        runtimeContext: {
          ...context.runtimeContext,
          transcript,
        },
      },
      this.metricsCollector.summarize(result, context.request.metadata),
    );
  }

  private async saveRuntimeMemorySummary(
    sessionId: string,
    request: AgentSessionRequest,
    result: AgentRuntimeResult,
  ): Promise<void> {
    if (result.status !== "success") {
      return;
    }

    await this.memoryStore.save(sessionId, [
      {
        key: "request_constraints",
        content: JSON.stringify(request.payload.prompt.userPrompt),
      },
      {
        key: "result_summary",
        content: result.payload.summary ?? result.payload.content ?? "",
      },
      {
        key: "observation_status",
        content: JSON.stringify({
          accepted: result.payload.accepted ?? false,
          completed: result.payload.completed ?? false,
          stopReason: result.payload.stopReason ?? "completed",
        }),
      },
    ]);
  }
}

function createRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
