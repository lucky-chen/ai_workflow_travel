import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { ExecutionStepResult, ITaskExecutor, PlanStepResult, PlanTask } from "./peo_types.js";

export class ExecutionStep {
  constructor(
    private readonly eventBus: RuntimeEventBus,
    private readonly directTaskExecutor: ITaskExecutor,
    private readonly reactTaskExecutor: ITaskExecutor,
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    input: AgentRunInput,
    _runId: string,
    stepIndex: number,
    plan: PlanStepResult,
  ): Promise<ExecutionStepResult> {
    const tasks = selectExecutableTasks(plan.tasks);
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "peo.execution.input",
      details: {
        runId: _runId,
        agent: "peo",
        step: "execution",
        stepIndex,
        input: {
          planSummary: plan.planSummary,
          tasks: tasks.map((task) => ({
            taskId: task.taskId,
            description: task.description,
            type: task.type,
          })),
          finalAnswer: plan.finalAnswer,
        },
      },
    });
    await this.eventBus.publish({
      type: "agent",
      agentMessage: {
        event: "step",
        traceId: _runId,
        timestamp: new Date().toISOString(),
        agent: {
          name: "peo",
          content: {
            step: "execution",
            stepIndex,
            input: {
              planSummary: plan.planSummary,
              tasks: tasks.map((task) => ({
                taskId: task.taskId,
                description: task.description,
                type: task.type,
              })),
              finalAnswer: plan.finalAnswer,
            },
          },
        },
      },
    });
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
      const executor = task.type === "react"
        ? this.reactTaskExecutor
        : this.directTaskExecutor;
      const taskExecution = await executor.execute({
        plan,
        task,
        stepIndex,
        context: input,
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
