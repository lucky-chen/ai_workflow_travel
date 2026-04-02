import type { Storage } from "../data/storage.js";
import type { SessionResult } from "../interface/api.js";
import { MetricsRecorder } from "./metrics-recorder.js";

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

export function createMetrics(storage: Storage): Metrics {
  return new MetricsRecorder(storage);
}
