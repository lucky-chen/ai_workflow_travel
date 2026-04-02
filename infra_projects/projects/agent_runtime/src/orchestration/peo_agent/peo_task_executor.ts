import type { AgentRunInput, IAgent } from "../../interface/agent-api.js";
import type { ITaskExecutor, PlanStepResult, PlanTask, TaskExecutionResult } from "./peo_types.js";

export class DirectTaskExecutor implements ITaskExecutor {
  async execute(input: {
    plan: PlanStepResult;
    task: PlanTask;
    stepIndex: number;
    context: AgentRunInput;
  }): Promise<TaskExecutionResult> {
    return {
      taskId: input.task.taskId,
      taskStatus: "completed",
      output: input.task.description,
      executionFacts: {
        toolCalls: 0,
        failedToolCalls: 0,
      },
    };
  }
}

export class ReactTaskExecutor implements ITaskExecutor {
  constructor(private readonly reactAgent: IAgent) {}

  async execute(input: {
    plan: PlanStepResult;
    task: PlanTask;
    stepIndex: number;
    context: AgentRunInput;
  }): Promise<TaskExecutionResult> {
    const result = await this.reactAgent.run(
      createTaskExecutionContext(input.context, input.plan, input.task, input.stepIndex),
    );
    if (result.errorInfo) {
      return {
        taskId: input.task.taskId,
        taskStatus: "failed",
        output: result.errorInfo.message ?? "Agent execution failed.",
        error: {
          code: result.errorInfo.code,
          message: result.errorInfo.message ?? "Agent execution failed.",
        },
      };
    }
    return {
      taskId: input.task.taskId,
      taskStatus: "completed",
      output: typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content ?? {}),
    };
  }
}

function createTaskExecutionContext(
  input: AgentRunInput,
  plan: PlanStepResult,
  task: PlanTask,
  stepIndex: number,
): AgentRunInput {
  return {
    userInput: {
      task: task.description,
      planSummary: plan.planSummary,
      taskId: task.taskId,
      taskType: task.type,
    },
  };
}
