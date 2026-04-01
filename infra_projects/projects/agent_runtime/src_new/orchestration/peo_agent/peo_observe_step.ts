import type { AgentContext } from "../../context/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { ObserveStepInput } from "./peo_types.js";

export class ObserveStep {
  constructor(private readonly eventBus: RuntimeEventBus) {}

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
    const checked = await this.check({
      executionResult: input.executionResult,
    });
    if (input.executionResult.task) {
      await this.eventBus.publish({
        type: "agent",
        agentMessage: {
          event: "task_completed",
          sessionId: context.runtimeContext?.sessionId,
          traceId: runId,
          timestamp: new Date().toISOString(),
          agent: {
            name: "peo",
            peo: {
              step: "observation",
              stepIndex,
              taskId: input.executionResult.task.taskId,
              taskType: input.executionResult.task.type,
              taskStatus: input.executionResult.taskExecution.taskStatus,
              taskCount: input.plan.tasks.length,
              taskResult: {
                taskId: input.executionResult.taskExecution.taskId,
                taskStatus: input.executionResult.taskExecution.taskStatus,
                output: input.executionResult.taskExecution.output,
                error: input.executionResult.taskExecution.error,
              },
              observationResult: checked,
            },
          },
        },
      });
    }
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
