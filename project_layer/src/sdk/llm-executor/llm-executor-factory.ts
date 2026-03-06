// LLM executor factory: selects a concrete executor implementation for the requested mode.
import type { ILlmExecutor } from "../../shared/contracts/llm-executor.js";
import { DeepSeekLlmExecutor } from "./deepseek-llm-executor.js";
import { MockLlmExecutor } from "./mock-llm-executor.js";
import { OpenAiLlmExecutor } from "./openai-llm-executor.js";
import type { RealProviderConfig } from "./real-provider-config.js";

export type LlmExecutorMode = "mock" | "real";

export interface LlmExecutorServiceDependencies {
  mode?: LlmExecutorMode;
  mockContent?: string;
  realProvider?: RealProviderConfig;
}

export function createLlmExecutor(dependencies: LlmExecutorServiceDependencies = {}): ILlmExecutor {
  if (dependencies.mode === "real") {
    return createRealProviderExecutor(dependencies.realProvider);
  }

  return new MockLlmExecutor(dependencies.mockContent);
}

function createRealProviderExecutor(config: RealProviderConfig = {}): ILlmExecutor {
  if (!config.provider) {
    throw new Error("Real LLM provider is required when mode is set to real.");
  }

  if (config.provider === "openai") {
    return new OpenAiLlmExecutor(config);
  }

  if (config.provider === "deepseek") {
    return new DeepSeekLlmExecutor(config);
  }

  throw new Error(`Unsupported real LLM provider: ${String(config.provider)}`);
}
