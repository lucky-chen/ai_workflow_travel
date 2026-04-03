import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import { ensureSuccessfulModelResponse, tryParseJsonRecord } from "../agent_parsing.js";

export class ObservationStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly sysPrompt: string[],
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    agentInput: AgentRunInput,
    runId: string,
    stepIndex: number,
    observationInput: {
      thought: string;
      actionType: "tool" | "respond";
      actionObservations: string[];
      priorObservation?: string;
      shouldContinue: boolean;
      finalAnswer?: string;
    },
  ): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const request = {
      systemPrompt: this.sysPrompt.concat([
        "Return valid JSON only.",
        "Summarize the current observation and decide whether the run is complete.",
      ]),
      responseFormat: "json",
      userPrompt: {
        stage: "react_observation",
        question: agentInput.userInput,
        priorObservation: observationInput.priorObservation,
        responseContract: {
          summary: "required string",
          completed: "required boolean",
          finalAnswer: "required string when completed is true",
        },
        runtimeState: {
          stepIndex,
        },
        action: {
          thought: observationInput.thought,
          actionType: observationInput.actionType,
          actionObservations: observationInput.actionObservations,
        },
      },
      stream: false,
    } satisfies ModuleRequest;
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "react.observation.input",
      details: {
        runId,
        agent: "react",
        step: "observation",
        stepIndex,
        input: request.userPrompt,
      },
    });
    const response = await this.executeModel(agentInput, runId, stepIndex, request);
    const checked = await this.check({
      content: response.content,
      observations: observationInput.actionObservations,
      shouldContinue: observationInput.shouldContinue,
      finalAnswer: observationInput.finalAnswer,
    });
    return checked;
  }

  private check(observation: Record<string, unknown>): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const content = typeof observation.content === "string" ? observation.content : "";
    const parsed = tryParseJsonRecord(content);
    const firstObservation = Array.isArray(observation.observations)
      ? observation.observations.find((value): value is string => typeof value === "string" && value.trim().length > 0)
      : undefined;
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim()
      ? parsed.summary
      : typeof firstObservation === "string" && firstObservation.trim()
        ? firstObservation
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
    return Promise.resolve({
      summary,
      completed: !shouldContinue,
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
