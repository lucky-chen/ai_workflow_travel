import type { LlmExecutionRequest } from "../../sdk/llm-executor/llm-executor.js";
import type { PromptBuildInput } from "./types.js";
export declare class ImplementationPromptBuilder {
    build(input: PromptBuildInput): LlmExecutionRequest;
}
