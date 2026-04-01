import type { McpGateway, McpToolRegistry } from "../../capability/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { AgentContext } from "../../context/types.js";
import { getRuntimeContext } from "../agent_orchestration_helpers.js";
import { validateToolCallArguments } from "../tool_call_argument_validator.js";
import type { ReactToolCall } from "./react_thought_step.js";

export class ActionStep {
  constructor(
    private readonly gateway: McpGateway,
    private readonly toolRegistry: McpToolRegistry,
    private readonly eventBus: RuntimeEventBus,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    thought: {
      thought: string;
      actionType: "tool" | "respond";
      toolCalls?: ReactToolCall[];
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
    const runtimeContext = getRuntimeContext(context);
    await this.eventBus.publish({
      type: "agent",
      agentMessage: {
        event: "step",
        sessionId: runtimeContext.sessionId,
        traceId: runId,
        timestamp: new Date().toISOString(),
        agent: {
          name: "react",
          content: {
            step: "action",
            stepIndex,
            input: {
              thought: thought.thought,
              actionType: thought.actionType,
              toolCalls: thought.toolCalls,
              shouldContinue: thought.shouldContinue,
              finalAnswer: thought.finalAnswer,
            },
          },
        },
      },
    });
    const observations: string[] = [];
    let executedToolCalls = 0;
    let failedToolCalls = 0;
    for (let index = 0; index < thought.toolCalls.length; index += 1) {
      const toolCall = thought.toolCalls[index];
      const validation = await validateToolCallArguments({
        toolRegistry: this.toolRegistry,
        toolName: toolCall.toolName,
        arguments: toolCall.arguments,
      });
      if (!validation.valid) {
        observations.push(`Tool argument validation failed for ${toolCall.toolName}: ${validation.errors.join(" ")}`);
        continue;
      }
      const result = await this.gateway.call({
        toolCallId: `${runId}:react:${stepIndex}:${index + 1}:${toolCall.toolName}`,
        toolName: toolCall.toolName,
        arguments: toolCall.arguments,
        eventAgent: runtimeContext.eventAgentOverride ?? {
          name: "react",
          content: {
            step: "action",
            stepIndex,
            input: {
              toolCalls: thought.toolCalls,
            },
          },
        },
      });
      executedToolCalls += 1;
      if (result.error) {
        failedToolCalls += 1;
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
