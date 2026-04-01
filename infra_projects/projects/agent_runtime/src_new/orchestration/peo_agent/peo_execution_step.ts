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
    await this.eventBus.publish({
      type: "task_selected",
      metadata: {
        sessionId: context.runtimeContext?.sessionId,
        traceId: _runId,
        timestamp: new Date().toISOString(),
      },
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
    await this.eventBus.publish({
      type: "task_completed",
      metadata: {
        sessionId: context.runtimeContext?.sessionId,
        traceId: _runId,
        timestamp: new Date().toISOString(),
      },
      agent: {
        name: "peo",
        peo: {
          step: "observation",
          stepIndex,
          taskId: task.taskId,
          taskType: task.type,
          taskStatus: taskExecution.taskStatus,
          taskCount: plan.tasks.length,
        },
      },
      custom: taskExecution.error
        ? {
          error: taskExecution.error,
        }
        : undefined,
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
