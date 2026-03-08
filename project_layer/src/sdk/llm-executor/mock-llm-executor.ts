// Mock LLM executor: deterministic executor used for local tests and workflow bring-up.
import type {
  ILlmExecutor,
  LlmExecutionRequest,
  LlmExecutionResult,
} from "./llm-executor.js";

export class MockLlmExecutor implements ILlmExecutor {
  constructor(private readonly mockContent?: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content:
        this.mockContent ??
        JSON.stringify({
          summary: "Mock implementation change set",
          changed_files: [],
          request_preview: request.prompt.userPrompt.slice(0, 200),
        }),
      responseFormat: request.responseFormat,
      metadata: request.metadata,
    };
  }
}
