import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "./llm-executor.js";
import type { RealProviderConfig } from "./real-provider-config.js";
export declare class OpenAiLlmExecutor implements ILlmExecutor {
    private readonly config;
    private readonly httpClient;
    constructor(config: RealProviderConfig);
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
