import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
import type { StringMap } from "../../shared/types/common.js";
import type { LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
export type { LlmExecutorMode, LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
export type { RealLlmProvider, RealProviderConfig } from "ai-meta-agent-agent-runtime";
export interface PromptInput {
    systemPrompt: string;
    userPrompt: string;
}
export interface LlmExecutionRequest {
    prompt: PromptInput;
    responseFormat: "text" | "json";
    metadata?: StringMap;
}
export interface LlmExecutionResult {
    content: string;
    responseFormat: "text" | "json";
    metadata?: StringMap;
}
export interface ILlmExecutor {
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
export declare class LlmExecutorService implements ILlmExecutor {
    private readonly agent;
    private readonly traceRecorder?;
    constructor(dependencies?: LlmExecutorServiceDependencies & {
        traceRecorder?: ITraceRecorder;
    });
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
