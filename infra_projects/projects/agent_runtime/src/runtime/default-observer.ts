import type {
  AgentContext,
  ExecutionPlan,
  ExecutionResult,
  IObserver,
  ObservationResult,
} from "./agent-runtime-types.js";

export class DefaultObserver implements IObserver {
  async observe(
    _context: AgentContext,
    plan: ExecutionPlan,
    result: ExecutionResult,
  ): Promise<ObservationResult> {
    if (!result.content.trim()) {
      return {
        accepted: false,
        summary: "Execution result is empty.",
        completed: false,
        issues: [
          {
            code: "empty_execution_result",
            message: "Execution result content must be non-empty.",
            severity: "high",
          },
        ],
        continueReason: "Need a non-empty execution result before continuing.",
      };
    }

    return {
      accepted: true,
      summary: "Result accepted.",
      completed: plan.completed ?? true,
    };
  }
}
