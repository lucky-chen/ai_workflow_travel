// Work-execute prompt builder: converts item design and project context into a stable LLM request.
import type { LlmExecutionRequest } from "../../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { PromptBuildInput } from "./types.js";

export class WorkExecutePromptBuilder {
  build(input: PromptBuildInput): LlmExecutionRequest {
    return {
      prompt: {
        systemPrompt:
          "You generate concrete project file changes. Return JSON with summary and changed_files only. " +
          "Each changed_files item must include path, operation, and content for create or update operations.",
        userPrompt: {
          target: "work_execute",
          workplanRef: input.preparedStepContext.workplanRef,
          workplan: input.preparedStepContext.workplan,
          currentBatch: input.preparedStepContext.currentBatch,
          upstreamContext: input.preparedStepContext.upstreamContext,
          projectContext: {
            rootPath: input.projectContext.rootPath,
            relevantFiles: input.projectContext.relevantFiles,
          },
          requiredOutputShape: {
            summary: "string",
            changed_files: [
              {
                path: "relative/file/path",
                operation: "create | update | delete",
                content: "required for create and update",
              },
            ],
          },
        },
      },
      responseFormat: "json",
      metadata: {
        executionUnit: "work_execute",
      },
    };
  }
}
