import { PlanningPromptBuilder } from "../loop/planning-prompt-builder.js";
import type {
  AgentContext,
  ExecutionPlan,
  IModelBackend,
  IPlanner,
  PlannerLoopState,
} from "./agent-runtime-types.js";

export class DefaultPlanner implements IPlanner {
  constructor(
    private readonly backend: IModelBackend,
    private readonly promptBuilder: PlanningPromptBuilder = new PlanningPromptBuilder(),
  ) {}

  async plan(context: AgentContext, loopState?: PlannerLoopState): Promise<ExecutionPlan> {
    const request = this.promptBuilder.build({
      context,
      priorStepResults: loopState?.priorStepResults,
      priorObservation: loopState?.priorObservation,
      stepIndex: loopState?.stepIndex,
    });
    const result = await this.backend.execute(request);
    return parseExecutionPlan(result.content, loopState?.stepIndex ?? 1);
  }
}

function parseExecutionPlan(content: string, stepIndex: number): ExecutionPlan {
  const parsed = JSON.parse(content) as Partial<ExecutionPlan>;

  return {
    mode: parsed.mode ?? "direct_generation",
    summary: parsed.summary ?? "",
    stepIndex: parsed.stepIndex ?? stepIndex,
    nextStepGoal: parsed.nextStepGoal ?? "",
    ...(parsed.completed !== undefined ? { completed: parsed.completed } : {}),
    ...(parsed.stopReason ? { stopReason: parsed.stopReason } : {}),
    ...(parsed.toolSteps ? { toolSteps: parsed.toolSteps } : {}),
  };
}
