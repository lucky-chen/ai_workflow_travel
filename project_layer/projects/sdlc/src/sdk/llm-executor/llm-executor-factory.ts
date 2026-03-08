// LLM executor factory: builds the default agent runtime used by the SDLC-facing llm executor facade.
import {
  ExecutionStrategySelector,
  createDefaultAgent,
  type IAgent,
  type IAgentTraceRecorder,
  type ModelExecutionDependencies,
  type ModelExecutionMode,
  type RealProviderConfig,
} from "ai-meta-agent-agent-runtime";

export type LlmExecutorMode = ModelExecutionMode;

export interface LlmExecutorServiceDependencies extends ModelExecutionDependencies {
  mode?: LlmExecutorMode;
  realProvider?: RealProviderConfig;
}

export function createLlmExecutorAgent(
  dependencies: LlmExecutorServiceDependencies = {},
  traceRecorder?: IAgentTraceRecorder,
): IAgent {
  const selector = new ExecutionStrategySelector();
  const backend = selector.select(dependencies).executor;
  return createDefaultAgent({
    backend,
    traceRecorder,
  });
}
