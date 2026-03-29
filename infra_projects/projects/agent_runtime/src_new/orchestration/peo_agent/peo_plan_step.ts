import type { McpToolRegistry } from "../../capability/types.js";
import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import type { Trace } from "../../observability/trace.js";
import {
  ensureSuccessfulModelResponse,
  getRuntimeContext,
  isRecord,
  matchAvailableToolName,
  summarizeModuleRequest,
  summarizeModuleResponse,
  summarizeToolDefinitions,
  tryParseJsonRecord,
} from "../agent_orchestration_helpers.js";
import type { PlanStepResult } from "./peo_types.js";

export const PEO_STAGE_COUNT = 3;

export class PlanStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly trace: Trace,
    private readonly toolRegistry: McpToolRegistry,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    },
  ): Promise<PlanStepResult> {
    const request = await this.buildPrompt(context, stepIndex, state);
    const response = await this.executeModel(context, runId, stepIndex, request);
    return this.check({
      content: response.content,
      availableTools: Array.isArray(request.userPrompt.availableTools)
        ? request.userPrompt.availableTools
          .map((value) => isRecord(value) && typeof value.name === "string" ? value.name : undefined)
          .filter((value): value is string => typeof value === "string")
        : [],
    });
  }

  private async buildPrompt(
    context: AgentContext,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    },
  ): Promise<ModuleRequest> {
    const runtimeContext = getRuntimeContext(context);
    const toolDefinitions = await this.toolRegistry.listToolDefinitions();
    const availableTools = toolDefinitions.map((tool) => tool.name);
    return {
      systemPrompt: [
        "You are the plan stage inside the PEO agent.",
        "Return valid JSON only.",
        "Return one plan result object only.",
        "Produce the next plan only. Do not answer the user directly outside the JSON contract.",
        `Only use tool names from this allowlist when a tool call is required: ${availableTools.join(", ")}.`,
        "Return toolCall only when a tool must be executed before observation.",
        "When no tool is needed, omit toolCall.",
        "Use finalAnswer only when the plan can already answer directly.",
        "Do not add fields outside the contract.",
        "Do not return executionType.",
        "Do not return executionPayload.",
        "Do not use alternate tool field names such as tool, parameters, or payload.",
        "When toolCall is present, it must use exactly this shape: {\"toolCallId\":\"string optional\",\"toolName\":\"string\",\"arguments\":{...}}.",
        "When toolCall is absent, the plan must still describe the next execution intent in `plan`.",
      ],
      responseFormat: "json",
      userPrompt: {
        stage: "peo_plan",
        stepIndex,
        maxStages: PEO_STAGE_COUNT,
        userInput: runtimeContext.userInput.content,
        priorObservation: state.lastObservation?.summary,
        priorExecutionSummaries: state.priorExecutionSummaries,
        availableTools: summarizeToolDefinitions(toolDefinitions),
        expectedSchema: {
          plan: "string",
          toolCall: {
            toolCallId: "string optional",
            toolName: "string",
            arguments: "Record<string, unknown>",
          },
          finalAnswer: "string optional",
        },
      },
      stream: false,
    };
  }

  private async check(plan: Record<string, unknown>): Promise<PlanStepResult> {
    const content = typeof plan.content === "string" ? plan.content : "";
    if (!content.trim()) {
      throw new Error("PEO plan is empty.");
    }
    const parsed = tryParseJsonRecord(content);
    const parsedToolCall = isRecord(parsed?.toolCall) ? parsed.toolCall : undefined;
    const availableTools = Array.isArray(plan.availableTools)
      ? plan.availableTools.filter((value): value is string => typeof value === "string")
      : [];
    const toolName = typeof parsedToolCall?.toolName === "string"
      ? parsedToolCall.toolName
      : typeof parsed?.toolName === "string"
        ? parsed.toolName
        : matchAvailableToolName(content, availableTools);
    const argumentsValue = isRecord(parsedToolCall?.arguments)
      ? parsedToolCall.arguments
      : isRecord(parsed?.arguments)
        ? parsed.arguments
        : isRecord(parsed?.executionPayload)
          ? parsed.executionPayload
          : undefined;
    return {
      plan: typeof parsed?.plan === "string" && parsed.plan.trim() ? parsed.plan : content,
      toolCall: toolName
        ? {
            toolCallId: typeof parsedToolCall?.toolCallId === "string" && parsedToolCall.toolCallId.trim()
              ? parsedToolCall.toolCallId
              : typeof parsed?.toolCallId === "string" && parsed.toolCallId.trim()
                ? parsed.toolCallId
              : "",
            toolName,
            arguments: argumentsValue ?? {},
          }
        : undefined,
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
    const model = this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
    await this.trace.record({
      scope: "session",
      eventType: "model_called",
      sessionId: runtimeContext.sessionId,
      payload: {
        stage: "peo_plan",
        stepIndex,
      },
      metadata: {
        traceId: runId,
        timestamp: new Date().toISOString(),
      },
    });
    try {
      const response = await model.execute(request);
      ensureSuccessfulModelResponse(response);
      return response;
    } catch (error) {
      const response = error && typeof error === "object" && "content" in error && "error" in error
        ? error as { content: string; error: { code: string; message: string } }
        : undefined;
      await this.trace.record({
        scope: "session",
        eventType: "model_result_recorded",
        sessionId: runtimeContext.sessionId,
        payload: {
          stage: "peo_plan",
          stepIndex,
          requestSummary: summarizeModuleRequest(request),
          responseSummary: response ? summarizeModuleResponse(response) : undefined,
          error: {
            code: response?.error.code ?? "MODEL_CALL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        },
        metadata: {
          traceId: runId,
          timestamp: new Date().toISOString(),
        },
      });
      throw error;
    }
  }
}
