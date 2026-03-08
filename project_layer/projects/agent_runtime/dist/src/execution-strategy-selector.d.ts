import type { IModelExecutionBackend, LlmExecutionRequest, LlmExecutionResult } from "./agent-runtime.js";
import type { RealProviderConfig } from "./real-provider-config.js";
export type ModelExecutionMode = "mock" | "real";
export interface ModelExecutionDependencies {
    mode?: ModelExecutionMode;
    mockContent?: string;
    realProvider?: RealProviderConfig;
}
export interface ExecutionStrategy {
    mode: ModelExecutionMode;
    executor: IModelExecutionBackend;
}
export declare class ExecutionStrategySelector {
    select(dependencies?: ModelExecutionDependencies): ExecutionStrategy;
}
export declare class MockModelExecutionBackend implements IModelExecutionBackend {
    private readonly mockContent?;
    constructor(mockContent?: string | undefined);
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
export declare class OpenAiModelExecutionBackend implements IModelExecutionBackend {
    private readonly config;
    private readonly httpClient;
    constructor(config: RealProviderConfig);
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
export declare class DeepSeekModelExecutionBackend implements IModelExecutionBackend {
    private readonly config;
    private readonly httpClient;
    constructor(config: RealProviderConfig);
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
