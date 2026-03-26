import type {
  AgentRuntimeResult,
  RequestMetadata,
  RuntimeMetrics,
} from "./agent-runtime-types.js";

export class RuntimeMetricsCollector {
  summarize(result: AgentRuntimeResult, metadata?: RequestMetadata): RuntimeMetrics {
    return {
      stepCount: result.payload.lastStepIndex ?? 0,
      ...(readNumber(metadata?.labels?.modelLatencyMs)),
      ...(readNumber(metadata?.labels?.toolLatencyMs, "toolLatencyMs")),
      ...(readNumber(metadata?.labels?.inputTokens, "inputTokens")),
      ...(readNumber(metadata?.labels?.outputTokens, "outputTokens")),
    };
  }
}

function readNumber(value: string | undefined, key = "modelLatencyMs"): Partial<RuntimeMetrics> {
  if (!value) {
    return {};
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return {};
  }

  return {
    [key]: parsed,
  } as Partial<RuntimeMetrics>;
}
