import type { McpGateway, McpToolRegistry } from "../../capability/types.js";
import type { AgentContext } from "../../context/types.js";
import { getRuntimeContext, isRecord } from "../agent_orchestration_helpers.js";
import { validateToolCallArguments } from "../tool_call_argument_validator.js";

export class ActionStep {
  constructor(
    private readonly gateway: McpGateway,
    private readonly toolRegistry: McpToolRegistry,
  ) {}

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
    const argumentsValue = isRecord(thought.actionPayload)
      ? thought.actionPayload
      : isRecord(runtimeContext.userInput.content.toolPayload)
        ? runtimeContext.userInput.content.toolPayload
        : {};
    const validation = await validateToolCallArguments({
      toolRegistry: this.toolRegistry,
      toolName: thought.toolName,
      arguments: argumentsValue,
    });
    if (!validation.valid) {
      return {
        observation: `Tool argument validation failed for ${thought.toolName}: ${validation.errors.join(" ")}`,
        shouldContinue: true,
        toolCalls: 0,
        failedToolCalls: 0,
      };
    }
    const result = await this.gateway.call({
      toolCallId: `${runId}:react:${stepIndex}:${thought.toolName}`,
      toolName: thought.toolName,
      arguments: argumentsValue,
      eventAgent: runtimeContext.eventAgentOverride ?? {
        name: "react",
        react: {
          step: "action",
          stepIndex,
          actionType: "tool",
        },
      },
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
