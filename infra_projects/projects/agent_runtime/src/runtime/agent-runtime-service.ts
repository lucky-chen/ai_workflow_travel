import { ContextAssembler } from "../context/context-assembler.js";
import { DefaultRetrievalProvider } from "../context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../context/runtime-memory-store.js";
import { SessionHistoryStore } from "../context/session-history-store.js";
import { ExecutionPromptBuilder } from "../loop/execution-prompt-builder.js";
import { ExecutionResultValidator } from "../loop/execution-result-validator.js";
import { ObservationValidator } from "../loop/observation-validator.js";
import { PlanValidator } from "../loop/plan-validator.js";
import { PlanningPromptBuilder } from "../loop/planning-prompt-builder.js";
import { ResultNormalizer } from "../loop/result-normalizer.js";
import { DefaultMcpGateway } from "../mcp/default-mcp-gateway.js";
import { ExecutionStrategySelector } from "../model/execution-strategy-selector.js";
import {
  AgentSessionManager,
} from "./agent-session-manager.js";
import { DefaultAgent } from "./default-agent.js";
import { DefaultExecutor } from "./default-executor.js";
import { DefaultObserver } from "./default-observer.js";
import { DefaultPlanner } from "./default-planner.js";
import { RuntimeMetricsCollector } from "./runtime-metrics-collector.js";
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
  private readonly metricsCollector = new RuntimeMetricsCollector();
  private readonly resultNormalizer = new ResultNormalizer();

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
    const strategy = new ExecutionStrategySelector().select();
    const agent = new DefaultAgent(
      new DefaultPlanner(strategy.executor, new PlanningPromptBuilder()),
      new PlanValidator(),
      new DefaultExecutor(strategy.executor, new DefaultMcpGateway(), new ExecutionPromptBuilder()),
      new ExecutionResultValidator(),
      new DefaultObserver(),
      new ObservationValidator(),
      this.dependencies.traceRecorder,
    );
    const result = await agent.run(context);

    await this.sessionManager.appendTranscript(sessionId, [
      {
        role: "user",
        content: JSON.stringify(request.payload.prompt.userPrompt),
      },
      {
        role: "assistant",
        content: result.payload.content ?? result.payload.summary ?? "",
      },
    ]);

    return this.resultNormalizer.normalize(
      result,
      context,
      this.metricsCollector.summarize(result, context.request.metadata),
    );
  }

  readSession(sessionId: string): Promise<AgentSessionState> {
    return this.sessionManager.readSession(sessionId);
  }

  getWorkdir(): string {
    return this.dependencies.workdir;
  }
}
