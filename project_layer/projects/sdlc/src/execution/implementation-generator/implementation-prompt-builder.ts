// Implementation prompt builder: converts module design and project context into a stable LLM request.
import type { LlmExecutionRequest } from "../../sdk/llm-executor/llm-executor.js";
import type { PromptBuildInput } from "./types.js";

export class ImplementationPromptBuilder {
  build(input: PromptBuildInput): LlmExecutionRequest {
    return {
      prompt: {
        systemPrompt:
          "You generate concrete project file changes. Return JSON with summary and changed_files only. " +
          "Each changed_files item must include path, operation, and content for create or update operations.",
        userPrompt: {
          target: "implementation",
          workplanRef: input.preparedStepContext.workplanRef,
          workplan: JSON.stringify(input.preparedStepContext.workplan),
          currentBatch: JSON.stringify(input.preparedStepContext.currentBatch),
          upstreamContext: JSON.stringify(input.preparedStepContext.upstreamContext),
          projectContext: JSON.stringify({
            rootPath: input.projectContext.rootPath,
            relevantFiles: input.projectContext.relevantFiles,
          }),
          requiredOutputShape: JSON.stringify({
            summary: "string",
            changed_files: [
              {
                path: "relative/file/path",
                operation: "create | update | delete",
                content: "required for create and update",
              },
            ],
          }),
        },
      },
      responseFormat: "json",
      metadata: {
        stage: "implementation",
      },
    };
  }
}
