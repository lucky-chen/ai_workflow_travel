import type {
  ExecutionPromptBuilderInput,
  ModelBackendRequest,
} from "../runtime/agent-runtime-types.js";

export class ExecutionPromptBuilder {
  build(input: ExecutionPromptBuilderInput): ModelBackendRequest {
    return {
      mode: "execution",
      responseFormat: input.context.request.responseFormat,
      metadata: input.context.request.metadata,
      prompt: {
        systemPrompt: [
          "You are the execution component inside AgentRuntime.",
          ...input.context.request.prompt.systemPrompt,
        ],
        userPrompt: {
          task: input.context.request.prompt.userPrompt,
          nextStepGoal: input.plan.nextStepGoal,
          history: input.context.runtimeContext.history,
          memory: input.context.runtimeContext.memory,
          retrievalContext: input.context.runtimeContext.retrievalContext,
          toolResults: input.toolResults ?? [],
        },
      },
    };
  }
}
