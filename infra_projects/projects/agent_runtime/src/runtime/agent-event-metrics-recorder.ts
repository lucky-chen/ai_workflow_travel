import type { AgentEvent, AgentType } from "../interface/agent-api.js";
import type { Metrics } from "../observability/metrics.js";

export class AgentEventMetricsRecorder {
  constructor(
    private readonly metrics: Metrics,
    private readonly initialization: Promise<void>,
  ) {}

  async handle(type: AgentType, event: AgentEvent): Promise<void> {
    if (event.brief !== "agent.run.finished" && event.brief !== "agent.run.failed") {
      return;
    }
    const details = event.details ?? {};
    const runId = typeof details.runId === "string" ? details.runId : "standalone-agent-run";
    await this.initialization;
    await this.metrics.collect({
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
    await this.metrics.flush();
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
