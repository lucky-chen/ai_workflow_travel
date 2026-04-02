import type {
  AgentEventListener,
  AgentType,
  IAgent,
} from "../interface/agent-api.js";
import type { ModelConfig } from "../model/types.js";
import type { AgentRuntimeComponents } from "./types.js";

export class AgentService {
  private readonly agentListeners = new WeakMap<IAgent, AgentEventListener>();

  constructor(
    readonly components: AgentRuntimeComponents,
    private readonly initialization: Promise<void>,
  ) {}

  async createAgent(type: AgentType): Promise<IAgent> {
    await this.initialization;
    const agent = this.components.agentFactory.create(type);
    const listener: AgentEventListener = {
      onEvent: async (event) => {
        await this.onAgentEvent(type, event);
      },
    };
    agent.subscribeEvents(listener);
    this.agentListeners.set(agent, listener);
    return agent;
  }

  async closeAgent(agent: IAgent): Promise<void> {
    const listener = this.agentListeners.get(agent);
    if (listener) {
      agent.unsubscribeEvents(listener);
      this.agentListeners.delete(agent);
    }
  }

  async createAgentInstance(
    type: AgentType,
    overrides: { modelConfig?: ModelConfig; sysPrompt?: string[] } = {},
  ): Promise<IAgent> {
    await this.initialization;
    return this.components.agentFactory.create(type, {
      modelConfig: overrides.modelConfig,
      sysPrompt: overrides.sysPrompt ?? [],
    });
  }

  private async onAgentEvent(type: AgentType, event: { brief: string; details?: Record<string, unknown> }): Promise<void> {
    if (event.brief !== "agent.run.finished" && event.brief !== "agent.run.failed") {
      return;
    }
    const details = event.details ?? {};
    const runId = typeof details.runId === "string" ? details.runId : "standalone-agent-run";
    await this.initialization;
    await this.components.metrics.collect({
      sessionId: runId,
      result: {
        sessionId: runId,
        format: typeof details.format === "string" ? (details.format as "text" | "json") : undefined,
        errorCode: typeof details.errorCode === "string" ? details.errorCode : undefined,
        errorMessage: typeof details.errorMessage === "string" ? details.errorMessage : undefined,
      },
      providerUsageFacts: {
        promptTokens: readMetricsTokenCount(details.metrics, "inputTokens"),
        completionTokens: readMetricsTokenCount(details.metrics, "outputTokens"),
      },
      toolExecutionFacts: {
        toolCalls: readMetricsToolCount(details.metrics, "toolCalls"),
        failedToolCalls: readMetricsToolCount(details.metrics, "failedToolCalls"),
      },
      runScope: {
        runId,
        agentName: type,
      },
    });
    await this.components.metrics.flush();
    await this.components.trace.flush();
  }
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readTokenCount(
  value: unknown,
  key: "inputTokens" | "outputTokens",
): number {
  if (!value || typeof value !== "object") {
    return 0;
  }
  const entry = (value as Record<string, unknown>)[key];
  return typeof entry === "number" && Number.isFinite(entry) ? entry : 0;
}

function readMetricsTokenCount(
  value: unknown,
  key: "inputTokens" | "outputTokens",
): number {
  if (!value || typeof value !== "object") {
    return 0;
  }
  return readTokenCount((value as Record<string, unknown>).tokenUsage, key);
}

function readMetricsToolCount(
  value: unknown,
  key: "toolCalls" | "failedToolCalls",
): number {
  if (!value || typeof value !== "object") {
    return 0;
  }
  const toolUsage = (value as Record<string, unknown>).toolUsage;
  if (!toolUsage || typeof toolUsage !== "object") {
    return 0;
  }
  return readNumber((toolUsage as Record<string, unknown>)[key]);
}
