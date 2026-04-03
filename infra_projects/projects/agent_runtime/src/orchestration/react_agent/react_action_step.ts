import type { McpGateway, McpToolRegistry, ToolCall } from "../../capability/types.js";
import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import { validateToolCallArguments } from "../tool_call_argument_validator.js";

export class ActionStep {
  constructor(
    private readonly gateway: McpGateway,
    private readonly toolRegistry: McpToolRegistry,
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    thought: {
      thought: string;
      actionType: "tool" | "respond";
      toolCalls?: ToolCall[];
      shouldContinue: boolean;
      finalAnswer?: string;
    },
  ): Promise<{
    observation: string;
    actionObservations: string[];
    shouldContinue: boolean;
    finalAnswer?: string;
    toolCalls: number;
    failedToolCalls: number;
  }> {
    if (thought.actionType !== "tool" || !Array.isArray(thought.toolCalls) || thought.toolCalls.length === 0) {
      return {
        observation: thought.thought,
        actionObservations: [thought.thought],
        shouldContinue: thought.shouldContinue,
        finalAnswer: thought.finalAnswer,
        toolCalls: 0,
        failedToolCalls: 0,
      };
    }
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "react.action.input",
      details: {
        runId,
        agent: "react",
        step: "action",
        stepIndex,
        input: {
          actionType: thought.actionType,
          toolCalls: thought.toolCalls.map((toolCall) => ({
            name: toolCall.name,
          })),
        },
      },
    });
    const observations: string[] = [];
    let executedToolCalls = 0;
    let failedToolCalls = 0;
    for (let index = 0; index < thought.toolCalls.length; index += 1) {
      const toolCall = thought.toolCalls[index];
      const validation = validateToolCallArguments({
        toolRegistry: this.toolRegistry,
        toolName: toolCall.name,
        arguments: toolCall.arguments,
      });
      if (!validation.valid) {
        observations.push(`Tool argument validation failed for ${toolCall.name}: ${validation.errors.join(" ")}`);
        continue;
      }
      await this.emitAgentEvent({
        timestamp: new Date().toISOString(),
        brief: "tool.call.started",
        details: {
          runId,
          agent: "react",
          step: "action",
          stepIndex,
          toolName: toolCall.name,
          arguments: toolCall.arguments,
        },
      });
      const result = await this.gateway.call({
        toolCallId: `${runId}:react:${stepIndex}:${index + 1}:${toolCall.name}`,
        toolName: toolCall.name,
        arguments: toolCall.arguments,
      });
      executedToolCalls += 1;
      if (result.error) {
        failedToolCalls += 1;
        await this.emitAgentEvent({
          timestamp: new Date().toISOString(),
          brief: "tool.call.failed",
          details: {
            runId,
            agent: "react",
            step: "action",
            stepIndex,
            toolName: toolCall.name,
            arguments: toolCall.arguments,
            error: result.error,
          },
        });
      }
      observations.push(result.error ? result.error.message : result.content);
    }
    const observation = observations.join("\n");
    return {
      observation,
      actionObservations: observations,
      shouldContinue: thought.shouldContinue,
      finalAnswer: thought.finalAnswer,
      toolCalls: executedToolCalls,
      failedToolCalls,
    };
  }
}
