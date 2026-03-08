import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "./llm-executor.js";
export declare class MockLlmExecutor implements ILlmExecutor {
    private readonly mockContent?;
    constructor(mockContent?: string | undefined);
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
