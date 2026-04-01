import type { AgentContext } from "../../context/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import {
  createContextBasis,
  ensureSuccessfulModelResponse,
  getRuntimeContext,
  summarizeModuleRequest,
  summarizeModuleResponse,
  tryParseJsonRecord,
} from "../agent_orchestration_helpers.js";

export class ObservationStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly eventBus: RuntimeEventBus,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    input: {
      thought: string;
      actionType: "tool" | "respond";
      actionObservation: string;
      priorObservation?: string;
      shouldContinue: boolean;
      finalAnswer?: string;
    },
  ): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const response = await this.executeModel(context, runId, stepIndex, {
      systemPrompt: [
        "Return valid JSON only.",
        "Summarize the current observation and decide whether the run is complete.",
      ],
      responseFormat: "json",
      userPrompt: {
        stage: "react_observation",
        question: getRuntimeContext(context).userInput.content,
        contextBasis: createContextBasis({
          context,
          priorObservation: input.priorObservation,
        }),
        expectedSchema: {
          summary: "required string",
          completed: "required boolean",
          finalAnswer: "required string when completed is true",
        },
        runtimeState: {
          stepIndex,
        },
        action: {
          thought: input.thought,
          actionType: input.actionType,
          actionObservation: input.actionObservation,
        },
      },
      stream: false,
    });
    return this.check({
      content: response.content,
      observation: input.actionObservation,
      shouldContinue: input.shouldContinue,
      finalAnswer: input.finalAnswer,
    });
  }

  private async check(observation: Record<string, unknown>): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const content = typeof observation.content === "string" ? observation.content : "";
    const parsed = tryParseJsonRecord(content);
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim()
      ? parsed.summary
      : typeof observation.observation === "string" && observation.observation.trim()
        ? observation.observation
        : content;
    if (!summary.trim()) {
      throw new Error("ReAct observation is invalid.");
    }
    const finalAnswer = typeof parsed?.finalAnswer === "string"
      ? parsed.finalAnswer
      : typeof observation.finalAnswer === "string"
        ? observation.finalAnswer
        : summary;
    const shouldContinue = parsed?.completed === false
      ? true
      : parsed?.continue === true
        ? true
        : observation.shouldContinue === true && !finalAnswer.trim()
          ? true
          : false;
    return {
      summary,
      completed: !shouldContinue,
      finalAnswer,
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
    await this.eventBus.publish({
      type: "model_started",
      metadata: {
        sessionId: runtimeContext.sessionId,
        traceId: runId,
        timestamp: new Date().toISOString(),
      },
      agent: {
        name: "react",
        react: {
          step: "observation",
          stepIndex,
        },
      },
    });
    try {
      const response = await model.execute(request);
      ensureSuccessfulModelResponse(response);
      await this.eventBus.publish({
        type: "model_completed",
        metadata: {
          sessionId: runtimeContext.sessionId,
          traceId: runId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          name: "react",
          react: {
            step: "observation",
            stepIndex,
          },
        },
      });
      return response;
    } catch (error) {
      const response = error && typeof error === "object" && "content" in error && "error" in error
        ? error as { content: string; error: { code: string; message: string } }
        : undefined;
      await this.eventBus.publish({
        type: "model_completed",
        metadata: {
          sessionId: runtimeContext.sessionId,
          traceId: runId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          name: "react",
          react: {
            step: "observation",
            stepIndex,
          },
        },
        custom: {
          requestSummary: summarizeModuleRequest(request),
          responseSummary: response ? summarizeModuleResponse(response) : undefined,
          error: {
            code: response?.error.code ?? "MODEL_CALL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });
      throw error;
    }
  }
}
