import type { ILlmExecutor } from "./llm-executor.js";
import type { LlmExecutorMode, LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
export interface ExecutionStrategy {
    mode: LlmExecutorMode;
    executor: ILlmExecutor;
}
export declare class ExecutionStrategySelector {
    select(dependencies?: LlmExecutorServiceDependencies): ExecutionStrategy;
    private createRealProviderExecutor;
}
