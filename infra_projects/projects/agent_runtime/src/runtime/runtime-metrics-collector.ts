import type {
  AgentRuntimeResult,
  RuntimeMetrics,
} from "./agent-runtime-types.js";

export class RuntimeMetricsCollector {
  summarize(result: AgentRuntimeResult): RuntimeMetrics {
    return {
      stepCount: result.payload.lastStepIndex ?? 0,
    };
  }
}
