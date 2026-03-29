import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import type { Trace } from "../../observability/trace.js";
import {
  ensureSuccessfulModelResponse,
  getRuntimeContext,
  tryParseJsonRecord,
} from "../agent_orchestration_helpers.js";
import type { ObserveStepInput } from "./peo_types.js";

export class ObserveStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly trace: Trace,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    input: ObserveStepInput,
  ): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const response = await this.executeModel(context, runId, stepIndex, {
      systemPrompt: [
        "You are the observe stage inside the PEO agent.",
        "Return valid JSON only.",
        "Decide whether the current plan-execution result is complete.",
      ],
      responseFormat: "json",
      userPrompt: {
        stage: "peo_observe",
        stepIndex,
        plan: input.plan,
        executionResult: input.executionResult,
        priorObservation: input.priorObservation,
        userInput: getRuntimeContext(context).userInput.content,
      },
      stream: false,
    });
    return this.check({
      content: response.content,
      executionResult: input.executionResult,
    });
  }

  private async check(observation: Record<string, unknown>): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const content = typeof observation.content === "string" ? observation.content : "";
    const parsed = tryParseJsonRecord(content);
    const executionResult = observation.executionResult && typeof observation.executionResult === "object"
      ? observation.executionResult as {
          executionObservation?: unknown;
          finalAnswer?: unknown;
        }
      : undefined;
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim()
      ? parsed.summary
      : content || String(executionResult?.executionObservation ?? "");
    if (!summary.trim()) {
      throw new Error("PEO observation is invalid.");
    }
    return {
      summary,
      completed: parsed?.completed === false
        ? false
        : parsed?.continue === true
          ? false
          : true,
      finalAnswer: typeof parsed?.finalAnswer === "string"
        ? parsed.finalAnswer
        : typeof executionResult?.finalAnswer === "string"
          ? executionResult.finalAnswer
          : summary,
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
      traceId: runId,
      scope: "session",
      eventType: "model_called",
      timestamp: new Date().toISOString(),
      summary: "peo observe model called",
      sessionId: runtimeContext.sessionId,
      runId,
      stepIndex,
    });
    const response = await model.execute(request);
    ensureSuccessfulModelResponse(response);
    return response;
  }
}
