import type { ILlmExecutor } from "../../shared/contracts/llm-executor.js";
import { DeepSeekLlmExecutor } from "./deepseek-llm-executor.js";
import { MockLlmExecutor } from "./mock-llm-executor.js";
import { OpenAiLlmExecutor } from "./openai-llm-executor.js";
import type { LlmExecutorMode, LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
import type { RealProviderConfig } from "./real-provider-config.js";

export interface ExecutionStrategy {
  mode: LlmExecutorMode;
  executor: ILlmExecutor;
}

export class ExecutionStrategySelector {
  select(dependencies: LlmExecutorServiceDependencies = {}): ExecutionStrategy {
    if (dependencies.mode === "real") {
      return {
        mode: "real",
        executor: this.createRealProviderExecutor(dependencies.realProvider),
      };
    }

    return {
      mode: "mock",
      executor: new MockLlmExecutor(dependencies.mockContent),
    };
  }

  private createRealProviderExecutor(config: RealProviderConfig = {}): ILlmExecutor {
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
}
