import type {
  ExecutionPromptBuilderInput,
  ModelBackendRequest,
} from "../runtime/agent-runtime-types.js";

export class ExecutionPromptBuilder {
  build(input: ExecutionPromptBuilderInput): ModelBackendRequest {
    const outputContract = resolveOutputContract(input);
    return {
      mode: "execution",
      responseFormat: input.context.request.responseFormat,
      metadata: input.context.request.metadata,
      prompt: {
        systemPrompt: [
          "You are the execution component inside AgentRuntime.",
          `Request intent is '${input.plan.intent}'.`,
          `Execution mode is '${input.plan.mode}'.`,
          ...outputContract.systemPrompt,
          ...input.context.request.prompt.systemPrompt,
        ],
        userPrompt: {
          intent: input.plan.intent,
          mode: input.plan.mode,
          task: input.context.request.prompt.userPrompt,
          nextStepGoal: input.plan.nextStepGoal,
          responseFormat: input.context.request.responseFormat,
          outputContract: outputContract.userPrompt,
          transcript: input.context.runtimeContext.transcript,
          memory: input.context.runtimeContext.memory,
          retrievalContext: input.context.runtimeContext.retrievalContext,
          toolResults: input.toolResults ?? [],
        },
      },
    };
  }
}

function resolveOutputContract(input: ExecutionPromptBuilderInput): {
  systemPrompt: string[];
  userPrompt: Record<string, unknown>;
} {
  if (input.context.request.responseFormat === "text") {
    return {
      systemPrompt: [
        "Return plain text only.",
      ],
      userPrompt: {
        type: "text",
      },
    };
  }

  if (input.plan.intent === "chat") {
    return {
      systemPrompt: [
        "Return one JSON object only.",
        "The JSON must have exactly one required field: answer.",
        "The answer field must be a string.",
      ],
      userPrompt: {
        type: "json_object",
        schema: {
          answer: "string",
        },
      },
    };
  }

  return {
    systemPrompt: [
      "Return valid JSON only.",
      "Return one JSON object only.",
      "The JSON must include a non-empty summary string field.",
      "You may include optional result details as additional fields.",
    ],
    userPrompt: {
      type: "structured_json",
      schema: {
        summary: "string",
      },
    },
  };
}
