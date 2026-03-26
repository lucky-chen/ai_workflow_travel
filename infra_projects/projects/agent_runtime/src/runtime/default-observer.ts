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
    _plan: ExecutionPlan,
    _result: ExecutionResult,
  ): Promise<ObservationResult> {
    return {
      accepted: true,
      summary: "Result accepted.",
      completed: true,
    };
  }
}
