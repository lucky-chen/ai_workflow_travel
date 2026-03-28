import type { SessionResult } from "../interface/api.js";
import type { Storage } from "../data/storage.js";

export interface MetricsSummary {
  requestCount: number;
  toolCallCount: number;
  failedRequestCount: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface MetricsResult {
  sessionMetrics: MetricsSummary;
  totalMetrics: MetricsSummary;
}

export interface MetricsCollectInput {
  sessionId: string;
  result: SessionResult;
  providerUsageFacts?: {
    promptTokens: number;
    completionTokens: number;
  };
  toolExecutionFacts?: {
    toolCalls: number;
    failedToolCalls: number;
  };
  runScope?: {
    runId: string;
    agentName: string;
  };
}

export interface Metrics {
  collect(input: MetricsCollectInput): Promise<void>;
  get(sessionId?: string): Promise<MetricsResult>;
  flush(): Promise<void>;
}

interface MetricsStoreState {
  sessions: Record<string, MetricsSummary>;
  total: MetricsSummary;
}

const EMPTY_SUMMARY = (): MetricsSummary => ({
  requestCount: 0,
  toolCallCount: 0,
  failedRequestCount: 0,
  tokenUsage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  },
});

export class StorageBackedMetrics implements Metrics {
  private readonly sessionMetrics = new Map<string, MetricsSummary>();
  private totalMetrics = EMPTY_SUMMARY();

  constructor(private readonly storage: Storage) {}

  async collect(input: MetricsCollectInput): Promise<void> {
    const session = cloneSummary(this.sessionMetrics.get(input.sessionId) ?? EMPTY_SUMMARY());
    const total = cloneSummary(this.totalMetrics);

    applyCollection(session, input);
    applyCollection(total, input);

    this.sessionMetrics.set(input.sessionId, session);
    this.totalMetrics = total;
  }

  async get(sessionId?: string): Promise<MetricsResult> {
    if (this.sessionMetrics.size === 0 && this.totalMetrics.requestCount === 0) {
      await this.loadPersisted();
    }

    return {
      sessionMetrics: cloneSummary(this.sessionMetrics.get(sessionId ?? "") ?? EMPTY_SUMMARY()),
      totalMetrics: cloneSummary(this.totalMetrics),
    };
  }

  async flush(): Promise<void> {
    const payload: MetricsStoreState = {
      sessions: Object.fromEntries([...this.sessionMetrics.entries()].map(([key, value]) => [key, cloneSummary(value)])),
      total: cloneSummary(this.totalMetrics),
    };
    await this.storage.save("metrics/summary", payload as unknown as Record<string, unknown>);
  }

  private async loadPersisted(): Promise<void> {
    try {
      const payload = await this.storage.load("metrics/summary");
      const sessions = isRecord(payload.sessions) ? payload.sessions : {};
      for (const [sessionId, value] of Object.entries(sessions)) {
        if (isRecord(value)) {
          this.sessionMetrics.set(sessionId, parseSummary(value));
        }
      }
      this.totalMetrics = isRecord(payload.total) ? parseSummary(payload.total) : EMPTY_SUMMARY();
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
    }
  }
}

function applyCollection(target: MetricsSummary, input: MetricsCollectInput): void {
  target.requestCount += 1;
  target.toolCallCount += input.toolExecutionFacts?.toolCalls ?? 0;
  if (input.result.errorCode) {
    target.failedRequestCount += 1;
  }

  const promptTokens = input.providerUsageFacts?.promptTokens ?? 0;
  const completionTokens = input.providerUsageFacts?.completionTokens ?? 0;
  target.tokenUsage.promptTokens += promptTokens;
  target.tokenUsage.completionTokens += completionTokens;
  target.tokenUsage.totalTokens += promptTokens + completionTokens;
}

function cloneSummary(summary: MetricsSummary): MetricsSummary {
  return {
    requestCount: summary.requestCount,
    toolCallCount: summary.toolCallCount,
    failedRequestCount: summary.failedRequestCount,
    tokenUsage: {
      promptTokens: summary.tokenUsage.promptTokens,
      completionTokens: summary.tokenUsage.completionTokens,
      totalTokens: summary.tokenUsage.totalTokens,
    },
  };
}

function parseSummary(payload: Record<string, unknown>): MetricsSummary {
  const tokenUsage = isRecord(payload.tokenUsage) ? payload.tokenUsage : {};
  return {
    requestCount: asNumber(payload.requestCount),
    toolCallCount: asNumber(payload.toolCallCount),
    failedRequestCount: asNumber(payload.failedRequestCount),
    tokenUsage: {
      promptTokens: asNumber(tokenUsage.promptTokens),
      completionTokens: asNumber(tokenUsage.completionTokens),
      totalTokens: asNumber(tokenUsage.totalTokens),
    },
  };
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
