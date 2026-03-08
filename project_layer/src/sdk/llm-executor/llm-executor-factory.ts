// LLM executor factory: selects a concrete executor implementation for the requested mode.
import type { ILlmExecutor } from "./llm-executor.js";
import { ExecutionStrategySelector } from "./execution-strategy-selector.js";
import type { RealProviderConfig } from "./real-provider-config.js";

export type LlmExecutorMode = "mock" | "real";

export interface LlmExecutorServiceDependencies {
  mode?: LlmExecutorMode;
  mockContent?: string;
  realProvider?: RealProviderConfig;
}

export function createLlmExecutor(dependencies: LlmExecutorServiceDependencies = {}): ILlmExecutor {
  const selector = new ExecutionStrategySelector();
  return selector.select(dependencies).executor;
}
