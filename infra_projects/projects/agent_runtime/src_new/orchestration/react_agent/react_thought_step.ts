import type { McpToolRegistry } from "../../capability/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import {
  createContextBasis,
  createToolUsageRules,
  ensureSuccessfulModelResponse,
  getRuntimeContext,
  isRecord,
  matchAvailableToolName,
  summarizeToolDefinitions,
  tryParseJsonRecord,
} from "../agent_orchestration_helpers.js";

export const REACT_MAX_STEPS = 2;

export class ThoughtStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly eventBus: RuntimeEventBus,
    private readonly toolRegistry: McpToolRegistry,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorActionSummaries: string[];
    },
  ): Promise<{
    thought: string;
    actionType: "tool" | "respond";
    toolName?: string;
    actionPayload?: Record<string, unknown>;
    shouldContinue: boolean;
    finalAnswer?: string;
  }> {
    const request = await this.buildPrompt(context, stepIndex, state);
    const response = await this.executeModel(context, runId, stepIndex, request);
    const checked = await this.check({
      content: response.content,
      availableTools: isRecord(request.userPrompt.tools) && Array.isArray(request.userPrompt.tools.availableTools)
        ? request.userPrompt.tools.availableTools
          .map((value) => isRecord(value) && typeof value.name === "string" ? value.name : undefined)
          .filter((value): value is string => typeof value === "string")
        : [],
    });
    await this.eventBus.publish({
      type: "agent",
      agentMessage: {
        event: "agent_step_completed",
        sessionId: getRuntimeContext(context).sessionId,
        traceId: runId,
        timestamp: new Date().toISOString(),
        agent: {
          name: "react",
          react: {
            step: "thought",
            stepIndex,
            actionType: checked.actionType,
            thoughtResult: {
              toolName: checked.toolName,
              actionPayload: checked.actionPayload,
              finalAnswer: checked.finalAnswer,
            },
          },
        },
      },
    });
    return checked;
  }

  private async buildPrompt(
    context: AgentContext,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorActionSummaries: string[];
    },
  ): Promise<ModuleRequest> {
    const runtimeContext = getRuntimeContext(context);
    const toolDefinitions = await this.toolRegistry.listToolDefinitions();
    return {
      systemPrompt: [
        "Return valid JSON only.",
        "Decide whether the next action is a tool call or a direct response.",
        "Do not output a tool call with missing required arguments.",
      ],
      responseFormat: "json",
      userPrompt: {
        stage: "react_thought",
        question: runtimeContext.userInput.content,
        contextBasis: createContextBasis({
          context,
          priorObservation: state.lastObservation?.summary,
          priorActionSummaries: state.priorActionSummaries,
        }),
        tools: {
          availableTools: summarizeToolDefinitions(toolDefinitions),
          toolUsageRules: createToolUsageRules("react"),
        },
        expectedSchema: {
          actionType: "\"tool\" | \"respond\"",
          toolName: "string required when actionType is tool",
          actionPayload: "object required when actionType is tool",
          finalAnswer: "string required when actionType is respond",
        },
        runtimeState: {
          stepIndex,
          iterationLimit: REACT_MAX_STEPS,
        },
      },
      stream: false,
    };
  }

  private async check(thought: Record<string, unknown>): Promise<{
    thought: string;
    actionType: "tool" | "respond";
    toolName?: string;
    actionPayload?: Record<string, unknown>;
    shouldContinue: boolean;
    finalAnswer?: string;
  }> {
    const content = typeof thought.content === "string" ? thought.content : "";
    if (!content.trim()) {
      throw new Error("ReAct thought is empty.");
    }
    const parsed = tryParseJsonRecord(content);
    const normalizedThought = typeof parsed?.thought === "string" && parsed.thought.trim()
      ? parsed.thought
      : content;
    const availableTools = Array.isArray(thought.availableTools)
      ? thought.availableTools.filter((value): value is string => typeof value === "string")
      : [];
    const toolName = typeof parsed?.toolName === "string"
      ? parsed.toolName
      : matchAvailableToolName(content, availableTools);
    const actionType = parsed?.actionType === "tool" || parsed?.actionType === "respond"
      ? parsed.actionType
      : toolName
        ? "tool"
        : "respond";
    return {
      thought: normalizedThought,
      actionType,
      toolName,
      actionPayload: isRecord(parsed?.actionPayload) ? parsed.actionPayload : undefined,
      shouldContinue: parsed?.shouldContinue === true || actionType === "tool",
      finalAnswer: typeof parsed?.finalAnswer === "string" ? parsed.finalAnswer : undefined,
    };
  }

  private async executeModel(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    request: ModuleRequest,
  ) {
    const runtimeContext = getRuntimeContext(context);
    request.runtimeEvent = {
      sessionId: runtimeContext.sessionId,
      traceId: runId,
      timestamp: new Date().toISOString(),
      agent: {
        name: "react",
        react: {
          step: "thought",
          stepIndex,
        },
      },
    };
    const model = this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
    try {
      const response = await model.execute(request);
      ensureSuccessfulModelResponse(response);
      return response;
    } catch (error) {
      throw error;
    }
  }
}
