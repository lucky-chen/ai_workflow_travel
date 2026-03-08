import { DeepSeekLlmExecutor } from "./deepseek-llm-executor.js";
import { MockLlmExecutor } from "./mock-llm-executor.js";
import { OpenAiLlmExecutor } from "./openai-llm-executor.js";
export class ExecutionStrategySelector {
    select(dependencies = {}) {
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
    createRealProviderExecutor(config = {}) {
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
