// LLM executor factory: selects a concrete executor implementation for the requested mode.
import type { ILlmExecutor } from "./llm-executor.js";
import {
  ExecutionStrategySelector,
  type ModelExecutionDependencies,
  type ModelExecutionMode,
  type RealProviderConfig,
} from "ai-meta-agent-agent-runtime";

export type LlmExecutorMode = ModelExecutionMode;

export interface LlmExecutorServiceDependencies extends ModelExecutionDependencies {
  mode?: LlmExecutorMode;
  realProvider?: RealProviderConfig;
}

export function createLlmExecutor(dependencies: LlmExecutorServiceDependencies = {}): ILlmExecutor {
  const selector = new ExecutionStrategySelector();
  return selector.select(dependencies).executor;
}
