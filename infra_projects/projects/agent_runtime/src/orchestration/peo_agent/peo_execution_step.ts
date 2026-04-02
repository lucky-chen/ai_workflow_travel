import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { ExecutionStepResult, ITaskExecutor, PlanStepResult, PlanTask } from "./peo_types.js";

export class ExecutionStep {
  constructor(
    private readonly reactTaskExecutor: ITaskExecutor,
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    plan: PlanStepResult,
  ): Promise<ExecutionStepResult> {
    const tasks = plan.tasks;
    await this.emitExecutionInput(runId, stepIndex, plan, tasks);
    if (plan.validationError) {
      return {
        tasks,
        taskResults: [],
        validationError: plan.validationError,
      };
    }
    const taskResults = await this.executeTasks(tasks, plan, stepIndex, input);
    return {
      tasks,
      taskResults,
      validationError: plan.validationError,
    };
  }

  private async emitExecutionInput(
    runId: string,
    stepIndex: number,
    plan: PlanStepResult,
    tasks: PlanTask[],
  ): Promise<void> {
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "peo.execution.input",
      details: {
        runId,
        agent: "peo",
        step: "execution",
        stepIndex,
        input: {
          planSummary: plan.planSummary,
          tasks: tasks.map((task) => ({
            name: task.name,
            description: task.description,
          })),
        },
      },
    });
  }

  private async executeTasks(
    tasks: PlanTask[],
    plan: PlanStepResult,
    stepIndex: number,
    input: AgentRunInput,
  ) {
    const taskResults = [];
    for (const task of tasks) {
      const taskResult = await this.reactTaskExecutor.execute({
        plan,
        task,
        stepIndex,
        context: input,
      });
      taskResults.push(taskResult);
    }
    return taskResults;
  }
}
