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
        userPrompt: JSON.stringify(
          {
            target: "implementation",
            moduleDesignDoc: input.moduleDesignDoc,
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
          null,
          2,
        ),
      },
      responseFormat: "json",
      metadata: {
        stage: "implementation",
      },
    };
  }
}
