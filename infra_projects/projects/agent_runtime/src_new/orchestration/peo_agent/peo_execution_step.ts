import type { AgentContext } from "../../context/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { ExecutionStepResult, ITaskExecutor, PlanStepResult, PlanTask } from "./peo_types.js";

export class ExecutionStep {
  constructor(
    private readonly eventBus: RuntimeEventBus,
    private readonly directTaskExecutor: ITaskExecutor,
    private readonly reactTaskExecutor: ITaskExecutor,
  ) {}

  async run(
    context: AgentContext,
    _runId: string,
    stepIndex: number,
    plan: PlanStepResult,
  ): Promise<ExecutionStepResult> {
    const tasks = selectExecutableTasks(plan.tasks);
    if (tasks.length === 0) {
      return {
        planSummary: plan.planSummary,
        finalAnswer: plan.finalAnswer,
        tasks: [],
        taskExecutions: [],
      };
    }
    const taskExecutions = [];
    for (const task of tasks) {
      await this.eventBus.publish({
        type: "agent",
        agentMessage: {
          event: "task_selected",
          sessionId: context.runtimeContext?.sessionId,
          traceId: _runId,
          timestamp: new Date().toISOString(),
          agent: {
            name: "peo",
            peo: {
              step: "task_execution",
              stepIndex,
              taskId: task.taskId,
              taskType: task.type,
              taskStatus: task.status,
              taskCount: plan.tasks.length,
            },
          },
        },
      });
      const executor = task.type === "react"
        ? this.reactTaskExecutor
        : this.directTaskExecutor;
      const taskExecution = await executor.execute({
        plan,
        task,
        stepIndex,
        context,
      });
      taskExecutions.push(taskExecution);
    }
    return {
      planSummary: plan.planSummary,
      tasks,
      taskExecutions,
      finalAnswer: plan.finalAnswer,
    };
  }
}

function selectExecutableTasks(tasks: PlanTask[]): PlanTask[] {
  const completed = new Set(
    tasks
      .filter((task) => task.status === "completed")
      .map((task) => task.taskId),
  );
  return tasks.filter((task) => (
    task.status === "pending"
    && (task.dependsOn ?? []).every((dependency) => completed.has(dependency))
  ));
}
