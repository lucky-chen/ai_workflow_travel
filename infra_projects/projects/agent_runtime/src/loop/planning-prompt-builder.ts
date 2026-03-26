import type {
  ModelBackendRequest,
  PlanningPromptBuilderInput,
} from "../runtime/agent-runtime-types.js";

export class PlanningPromptBuilder {
  build(input: PlanningPromptBuilderInput): ModelBackendRequest {
    const availableTools = input.availableTools ?? [];
    return {
      mode: "planning",
      responseFormat: "json",
      metadata: input.context.request.metadata,
      prompt: {
        systemPrompt: [
          "You are the planning component inside AgentRuntime.",
          "Return valid JSON only.",
          "Only return an ExecutionPlan object.",
          "Classify the request intent first.",
          "Use intent='chat' when the user can be answered directly from current context.",
          "Use intent='task' when the runtime needs tools, retrieval, or multi-step work before the final response.",
          `Only use tool names from this allowlist when toolSteps are required: ${availableTools.join(", ")}.`,
          "Do not answer the user task directly.",
          "Only produce the next execution plan.",
          "Do not add fields outside the ExecutionPlan contract.",
          "The JSON must contain: intent, mode, summary, stepIndex, nextStepGoal, optional completed, optional stopReason, optional toolSteps.",
          ...input.context.request.prompt.systemPrompt,
        ],
        userPrompt: {
          originalTask: input.context.request.prompt.userPrompt,
          responseFormat: input.context.request.responseFormat,
          history: input.context.runtimeContext.history,
          memory: input.context.runtimeContext.memory,
          retrievalContext: input.context.runtimeContext.retrievalContext,
          availableTools,
          priorStepResults: input.priorStepResults ?? [],
          priorObservation: input.priorObservation,
          stepIndex: input.stepIndex ?? 1,
          repairPhase: input.repairPhase,
          repairIssues: input.repairIssues ?? [],
          expectedSchema: {
            intent: "chat | task",
            mode: "direct_generation | tool_augmented_generation",
            summary: "string",
            stepIndex: "number",
            nextStepGoal: "string",
            completed: "boolean?",
            stopReason: "completed | max_steps | cancelled | failed ?",
            toolSteps: "McpToolRequest[]?",
          },
        },
      },
    };
  }
}
