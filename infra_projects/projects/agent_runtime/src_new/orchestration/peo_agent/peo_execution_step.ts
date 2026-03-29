import type { AgentContext } from "../../context/types.js";
import type { ExecutionStepResult, ITaskExecutor, PlanStepResult, PlanTask } from "./peo_types.js";

export class ExecutionStep {
  constructor(
    private readonly directTaskExecutor: ITaskExecutor,
    private readonly reactTaskExecutor: ITaskExecutor,
  ) {}

  async run(
    context: AgentContext,
    _runId: string,
    _stepIndex: number,
    plan: PlanStepResult,
  ): Promise<ExecutionStepResult> {
    const task = selectNextExecutableTask(plan.tasks);
    if (!task) {
      return {
        planSummary: plan.planSummary,
        finalAnswer: plan.finalAnswer,
        taskExecution: {
          taskId: "",
          taskStatus: "completed",
          output: plan.finalAnswer ?? plan.planSummary,
          executionFacts: {
            toolCalls: 0,
            failedToolCalls: 0,
          },
        },
      };
    }
    const executor = task.type === "react"
      ? this.reactTaskExecutor
      : this.directTaskExecutor;
    const taskExecution = await executor.execute({
      plan,
      task,
      context,
    });
    return {
      planSummary: plan.planSummary,
      task,
      taskExecution,
      finalAnswer: plan.finalAnswer,
    };
  }
}

function selectNextExecutableTask(tasks: PlanTask[]): PlanTask | undefined {
  const completed = new Set(
    tasks
      .filter((task) => task.status === "completed")
      .map((task) => task.taskId),
  );
  return tasks.find((task) => (
    task.status === "pending"
    && (task.dependsOn ?? []).every((dependency) => completed.has(dependency))
  ));
}
