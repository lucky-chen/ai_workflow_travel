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
          "Return one ExecutionPlan object only.",
          "Classify the request as `chat` or `task` before planning.",
          "Use `chat` when the user can be answered directly from the provided transcript, memory, retrieval context, and prior step results.",
          "Use `task` when the runtime must use tools, retrieval, or additional execution steps before the final response.",
          `Only use tool names from this allowlist when toolSteps are required: ${availableTools.join(", ")}.`,
          "Produce the next execution plan only. Do not answer the user task directly.",
          "Do not add fields outside the ExecutionPlan contract.",
          "The JSON must contain: intent, mode, summary, stepIndex, nextStepGoal, optional completed, optional stopReason, optional toolSteps.",
          "Use toolSteps only when mode is `tool_augmented_generation`.",
          "When toolSteps are present, each item must use exactly this shape: {\"toolName\":\"string\",\"arguments\":{...}}.",
          "Do not use alternate tool step field names such as tool or parameters.",
          "If `stopReason` is `completed`, then `completed` must be true.",
          "`repairPhase` identifies what failed last time: `plan` (prior plan), `execution`, or `observation`.",
          ...input.context.request.prompt.systemPrompt,
        ],
        userPrompt: {
          originalTask: input.context.request.prompt.userPrompt,
          responseFormat: input.context.request.responseFormat,
          transcript: input.context.runtimeContext.transcript,
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
            toolSteps: "[{ toolName: string, arguments: Record<string, unknown> }]?",
          },
        },
      },
    };
  }
}
