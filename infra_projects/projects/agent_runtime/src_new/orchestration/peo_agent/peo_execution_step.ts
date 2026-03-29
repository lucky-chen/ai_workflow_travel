import type { McpGateway } from "../../capability/types.js";
import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import type { Trace } from "../../observability/trace.js";
import {
  ensureSuccessfulModelResponse,
  getRuntimeContext,
  isRecord,
  summarizeModuleRequest,
  summarizeModuleResponse,
  tryParseJsonRecord,
} from "../agent_orchestration_helpers.js";
import type { ExecutionStepResult, PlanStepResult } from "./peo_types.js";

export class ExecutionStep {
  constructor(
    private readonly gateway: McpGateway,
    private readonly modelFactory: ModelFactory,
    private readonly trace: Trace,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    plan: PlanStepResult,
  ): Promise<ExecutionStepResult> {
    const toolCall = plan.toolCall
      ? {
          toolCallId: plan.toolCall.toolCallId.trim() || `${runId}:peo:${stepIndex}:${plan.toolCall.toolName}`,
          toolName: plan.toolCall.toolName,
          arguments: isRecord(plan.toolCall.arguments) ? plan.toolCall.arguments : {},
        }
      : undefined;
    const toolResult = toolCall
      ? await this.executeToolCall(toolCall)
      : {
          content: plan.finalAnswer ?? plan.plan,
        };
    return this.executeModel(context, runId, stepIndex, plan, toolCall, toolResult);
  }

  private async executeToolCall(toolCall: NonNullable<PlanStepResult["toolCall"]>): Promise<{
    content: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const result = await this.gateway.call(toolCall);
    return {
      content: result.content,
      errorCode: result.error?.code,
      errorMessage: result.error?.message,
    };
  }

  private async executeModel(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    plan: PlanStepResult,
    toolCall: ExecutionStepResult["toolCall"],
    toolResult: NonNullable<ExecutionStepResult["toolResult"]>,
  ): Promise<ExecutionStepResult> {
    const runtimeContext = getRuntimeContext(context);
    const model = this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
    const prompt: ModuleRequest = {
      systemPrompt: [
        "You are the execution stage inside the PEO agent.",
        "Return valid JSON only.",
        "Return one execution result object only.",
        "Use the plan and tool result to produce the execution result for the observe stage.",
      ],
      responseFormat: "json",
      userPrompt: {
        stage: "peo_execution",
        stepIndex,
        plan: plan.plan,
        userInput: runtimeContext.userInput.content,
        toolCall,
        toolResult,
        outputContract: {
          executionObservation: "string",
          finalAnswer: "string optional",
        },
      },
      stream: false,
    };
    await this.trace.record({
      scope: "session",
      eventType: "model_called",
      sessionId: runtimeContext.sessionId,
      payload: {
        stage: "peo_execution",
        stepIndex,
      },
      metadata: {
        traceId: runId,
        timestamp: new Date().toISOString(),
      },
    });
    try {
      const response = await model.execute(prompt);
      ensureSuccessfulModelResponse(response);
      return this.checkExecutionResult(response.content, plan, toolCall, toolResult);
    } catch (error) {
      const response = error && typeof error === "object" && "content" in error && "error" in error
        ? error as { content: string; error: { code: string; message: string } }
        : undefined;
      await this.trace.record({
        scope: "session",
        eventType: "model_result_recorded",
        sessionId: runtimeContext.sessionId,
        payload: {
          stage: "peo_execution",
          stepIndex,
          requestSummary: summarizeModuleRequest(prompt),
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

  private checkExecutionResult(
    content: string,
    plan: PlanStepResult,
    toolCall: ExecutionStepResult["toolCall"],
    toolResult: NonNullable<ExecutionStepResult["toolResult"]>,
  ): ExecutionStepResult {
    const parsed = tryParseJsonRecord(content);
    const executionObservation = typeof parsed?.executionObservation === "string" && parsed.executionObservation.trim()
      ? parsed.executionObservation
      : content || toolResult.errorMessage || toolResult.content || plan.plan;
    const finalAnswer = typeof parsed?.finalAnswer === "string"
      ? parsed.finalAnswer
      : plan.finalAnswer;
    if (!plan.toolCall) {
      return {
        executionObservation,
        finalAnswer,
        toolCalls: 0,
        failedToolCalls: 0,
        toolResult,
      };
    }
    return {
      executionObservation,
      finalAnswer,
      toolCalls: 1,
      failedToolCalls: toolResult.errorCode ? 1 : 0,
      toolCall,
      toolResult,
    };
  }
}
