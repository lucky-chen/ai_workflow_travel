import type {
  AgentContext,
  AgentRuntimeResult,
  RuntimeMetrics,
} from "../runtime/agent-runtime-types.js";

export class ResultNormalizer {
  normalize(
    result: AgentRuntimeResult,
    context: AgentContext,
    metrics: RuntimeMetrics,
  ): AgentRuntimeResult {
    return {
      ...result,
      payload: {
        ...result.payload,
        transcript: context.runtimeContext.transcript,
        memory: context.runtimeContext.memory,
        retrievalContext: context.runtimeContext.retrievalContext,
        metrics,
      },
    };
  }
}
