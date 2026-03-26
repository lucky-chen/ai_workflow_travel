import type {
  ModelBackendRequest,
  PlanningPromptBuilderInput,
} from "../runtime/agent-runtime-types.js";

export class PlanningPromptBuilder {
  build(input: PlanningPromptBuilderInput): ModelBackendRequest {
    return {
      mode: "planning",
      responseFormat: "json",
      metadata: input.context.request.metadata,
      prompt: {
        systemPrompt: [
          "You are the planning component inside AgentRuntime.",
          "Return valid JSON only.",
          ...input.context.request.prompt.systemPrompt,
        ],
        userPrompt: {
          task: input.context.request.prompt.userPrompt,
          history: input.context.runtimeContext.history,
          memory: input.context.runtimeContext.memory,
          retrievalContext: input.context.runtimeContext.retrievalContext,
          priorStepResults: input.priorStepResults ?? [],
          priorObservation: input.priorObservation,
          stepIndex: input.stepIndex ?? 1,
          expectedSchema: "ExecutionPlan",
        },
      },
    };
  }
}
