export interface PromptInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmExecutionRequest {
  prompt: PromptInput;
}

export interface LlmExecutionResult {
  content: string;
}

export interface ILlmExecutor {
  execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
