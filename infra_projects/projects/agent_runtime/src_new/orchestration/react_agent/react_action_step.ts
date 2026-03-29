import type { McpGateway } from "../../capability/types.js";
import type { AgentContext } from "../../context/types.js";
import { getRuntimeContext, isRecord } from "../agent_orchestration_helpers.js";

export class ActionStep {
  constructor(private readonly gateway: McpGateway) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    thought: {
      thought: string;
      actionType: "tool" | "respond";
      toolName?: string;
      actionPayload?: Record<string, unknown>;
      shouldContinue: boolean;
      finalAnswer?: string;
    },
  ): Promise<{
    observation: string;
    shouldContinue: boolean;
    finalAnswer?: string;
    toolCalls: number;
    failedToolCalls: number;
  }> {
    if (thought.actionType !== "tool" || typeof thought.toolName !== "string") {
      return {
        observation: thought.thought,
        shouldContinue: thought.shouldContinue,
        finalAnswer: thought.finalAnswer,
        toolCalls: 0,
        failedToolCalls: 0,
      };
    }
    const runtimeContext = getRuntimeContext(context);
    const result = await this.gateway.call({
      toolCallId: `${runId}:react:${stepIndex}:${thought.toolName}`,
      toolName: thought.toolName,
      arguments: isRecord(thought.actionPayload)
        ? thought.actionPayload
        : isRecord(runtimeContext.userInput.content.toolPayload)
        ? runtimeContext.userInput.content.toolPayload
        : {},
    });
    return {
      observation: result.error ? result.error.message : result.content,
      shouldContinue: thought.shouldContinue,
      finalAnswer: thought.finalAnswer,
      toolCalls: 1,
      failedToolCalls: result.error ? 1 : 0,
    };
  }
}
