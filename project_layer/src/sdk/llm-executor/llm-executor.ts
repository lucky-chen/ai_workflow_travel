import type {
  ILlmExecutor,
  LlmExecutionRequest,
  LlmExecutionResult,
} from "../../shared/contracts/llm-executor.js";

export class LlmExecutorService implements ILlmExecutor {
  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: JSON.stringify({
        summary: "Mock implementation change set",
        changed_files: [],
        request_preview: request.prompt.userPrompt.slice(0, 200),
      }),
    };
  }
}
