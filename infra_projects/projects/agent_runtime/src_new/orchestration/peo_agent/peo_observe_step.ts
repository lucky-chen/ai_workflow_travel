import type { AgentContext } from "../../context/types.js";
import type { ObserveStepInput } from "./peo_types.js";

export class ObserveStep {
  async run(
    _context: AgentContext,
    _runId: string,
    _stepIndex: number,
    input: ObserveStepInput,
  ): Promise<{
    summary: string;
    completed: boolean;
    finalAnswer: string;
  }> {
    return this.check({
      executionResult: input.executionResult,
    });
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
          taskExecution?: unknown;
        }
      : undefined;
    const taskExecution = executionResult?.taskExecution && typeof executionResult.taskExecution === "object"
      ? executionResult.taskExecution as {
          output?: unknown;
          error?: unknown;
          taskStatus?: unknown;
        }
      : undefined;
    const error = taskExecution?.error && typeof taskExecution.error === "object"
      ? taskExecution.error as {
          message?: unknown;
        }
      : undefined;
    const summary = typeof error?.message === "string" && error.message.trim()
      ? error.message
      : typeof taskExecution?.output === "string" && taskExecution.output.trim()
        ? taskExecution.output
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
