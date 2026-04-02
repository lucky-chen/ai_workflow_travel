import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { ObserveStepInput } from "./peo_types.js";

export class ObserveStep {
  constructor(
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    agentInput: AgentRunInput,
    runId: string,
    stepIndex: number,
    observeInput: ObserveStepInput,
  ): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "peo.observation.input",
      details: {
        runId,
        agent: "peo",
        step: "observation",
        stepIndex,
        input: {
          planSummary: observeInput.executionResult.planSummary,
          taskExecutions: observeInput.executionResult.taskExecutions,
          finalAnswer: observeInput.executionResult.finalAnswer,
        },
      },
    });
    const checked = await this.check({
      executionResult: observeInput.executionResult,
    });
    return checked;
  }

  private async check(observation: Record<string, unknown>): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    const executionResult = observation.executionResult && typeof observation.executionResult === "object"
      ? observation.executionResult as {
          planSummary?: unknown;
          finalAnswer?: unknown;
          taskExecutions?: unknown;
        }
      : undefined;
    const taskExecutions = Array.isArray(executionResult?.taskExecutions)
      ? executionResult.taskExecutions as unknown[]
      : [];
    const firstFailure = taskExecutions.find((value) => (
      Boolean(value)
      && typeof value === "object"
      && Boolean((value as { error?: unknown }).error)
    ));
    const firstOutput = taskExecutions.find((value) => (
      Boolean(value)
      && typeof value === "object"
      && typeof (value as { output?: unknown }).output === "string"
      && String((value as { output?: unknown }).output).trim()
    ));
    const error = firstFailure && typeof firstFailure === "object" && typeof (firstFailure as { error?: unknown }).error === "object"
      ? (firstFailure as { error: { message?: unknown } }).error as {
          message?: unknown;
        }
      : undefined;
    const summary = typeof error?.message === "string" && error.message.trim()
      ? error.message
      : firstOutput && typeof firstOutput === "object" && typeof (firstOutput as { output?: unknown }).output === "string"
        ? String((firstOutput as { output?: unknown }).output)
        : typeof executionResult?.planSummary === "string"
          ? executionResult.planSummary
          : typeof observation.priorObservation === "string"
            ? observation.priorObservation
            : "";
    if (!summary.trim()) {
      throw new Error("PEO observation is invalid.");
    }
    const finalAnswer = typeof executionResult?.finalAnswer === "string" && executionResult.finalAnswer.trim()
      ? executionResult.finalAnswer
      : summary;
    return {
      summary,
      completed: typeof executionResult?.finalAnswer === "string" && executionResult.finalAnswer.trim().length > 0,
      finalAnswer,
    };
  }
}
