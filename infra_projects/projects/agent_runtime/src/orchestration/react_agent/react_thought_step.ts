import type { McpToolRegistry, ToolCall } from "../../capability/types.js";
import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import {
  createToolUsageRules,
  ensureSuccessfulModelResponse,
  isRecord,
  summarizeToolDefinitions,
  tryParseJsonRecord,
} from "../agent_parsing.js";

export const REACT_MAX_STEPS = 2;

export class ThoughtStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly toolRegistry: McpToolRegistry,
    private readonly sysPrompt: string[],
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorActionSummaries: string[];
    },
  ): Promise<{
    thought: string;
    actionType: "tool" | "respond";
    toolCalls?: ToolCall[];
    shouldContinue: boolean;
    finalAnswer?: string;
  }> {
    const request = this.buildPrompt(input, stepIndex, state);
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "react.thought.input",
      details: {
        runId,
        agent: "react",
        step: "thought",
        stepIndex,
        input: request.userPrompt,
      },
    });
    const response = await this.executeModel(input, runId, stepIndex, request);
    const checked = await this.check({
      content: response.content,
      availableTools: isRecord(request.userPrompt.tools) && Array.isArray(request.userPrompt.tools.availableTools)
        ? request.userPrompt.tools.availableTools
          .map((value) => isRecord(value) && typeof value.name === "string" ? value.name : undefined)
          .filter((value): value is string => typeof value === "string")
        : [],
    });
    return checked;
  }

  private buildPrompt(
    input: AgentRunInput,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorActionSummaries: string[];
    },
  ): ModuleRequest {
    const toolDefinitions = this.toolRegistry.listToolDefinitions();
    return {
      systemPrompt: this.sysPrompt.concat([
        "Return valid JSON only.",
        "Decide whether the next action is a tool call or a direct response.",
        "Do not output a tool call with missing required arguments.",
        "When action.type is tool, put tool call data under action.tool.",
        "When action.type is respond, put the final answer under action.respond.",
      ]),
      responseFormat: "json",
      userPrompt: {
        stage: "react_thought",
        question: input.userInput,
        priorObservation: state.lastObservation?.summary,
        priorActionSummaries: state.priorActionSummaries,
        tools: {
          availableTools: summarizeToolDefinitions(toolDefinitions),
          toolUsageRules: createToolUsageRules("react"),
        },
        responseContract: {
          thought: "required string",
          action: {
            type: "required \"tool\" | \"respond\"",
            tool: {
              toolCalls: {
                description: "required when action.type is tool",
                itemSchema: {
                  name: "required string",
                  arguments: "required object",
                },
              },
            },
            respond: {
              description: "used only when action.type is respond",
              finalAnswer: "required string",
            },
          },
        },
        runtimeState: {
          stepIndex,
          iterationLimit: REACT_MAX_STEPS,
        },
      },
      stream: false,
    };
  }

  private check(thought: Record<string, unknown>): Promise<{
    thought: string;
    actionType: "tool" | "respond";
    toolCalls?: ToolCall[];
    shouldContinue: boolean;
    finalAnswer?: string;
  }> {
    const content = typeof thought.content === "string" ? thought.content : "";
    if (!content.trim()) {
      throw new Error("ReAct thought is empty.");
    }
    const parsed = tryParseJsonRecord(content);
    const parsedAction = isRecord(parsed?.action) ? parsed.action : undefined;
    const parsedTool = isRecord(parsedAction?.tool) ? parsedAction.tool : undefined;
    const parsedRespond = isRecord(parsedAction?.respond) ? parsedAction.respond : undefined;
    const normalizedThought = typeof parsed?.thought === "string" && parsed.thought.trim()
      ? parsed.thought
      : content;
    const rawToolCalls = Array.isArray(parsedTool?.toolCalls)
      ? parsedTool.toolCalls
      : Array.isArray(parsed?.toolCalls)
        ? parsed.toolCalls
        : [];
    const toolCalls = rawToolCalls.length > 0
      ? rawToolCalls
        .map((value) => normalizeToolCall(value))
        .filter((value): value is ToolCall => Boolean(value))
      : [];
    const actionType = parsedAction?.type === "tool" || parsedAction?.type === "respond"
      ? parsedAction.type
      : parsed?.actionType === "tool" || parsed?.actionType === "respond"
        ? parsed.actionType
        : toolCalls.length > 0
          ? "tool"
          : "respond";
    const finalAnswer = typeof parsedRespond?.finalAnswer === "string"
      ? parsedRespond.finalAnswer
      : typeof parsed?.finalAnswer === "string"
        ? parsed.finalAnswer
        : undefined;
    return Promise.resolve({
      thought: normalizedThought,
      actionType,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      shouldContinue: parsed?.shouldContinue === true || actionType === "tool",
      finalAnswer,
    });
  }

  private async executeModel(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    request: ModuleRequest,
  ) {
    const model = await this.modelFactory.createDefaultModel();
    const response = await model.execute(request);
    ensureSuccessfulModelResponse(response);
    return response;
  }
}

function normalizeToolCall(value: unknown): ToolCall | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const name = typeof value.name === "string"
    ? value.name
    : typeof value.toolName === "string"
      ? value.toolName
      : undefined;
  if (!name) {
    return undefined;
  }
  return {
    name,
    arguments: isRecord(value.arguments)
      ? value.arguments
      : {},
  };
}
