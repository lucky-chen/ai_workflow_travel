import type { AgentContext } from "../../context/types.js";
import type { IAgent } from "../types.js";
import { getRuntimeContext } from "../agent_orchestration_helpers.js";
import type { ITaskExecutor, PlanStepResult, PlanTask, TaskExecutionResult } from "./peo_types.js";

export class DirectTaskExecutor implements ITaskExecutor {
  async execute(input: {
    plan: PlanStepResult;
    task: PlanTask;
    context: AgentContext;
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
    context: AgentContext;
  }): Promise<TaskExecutionResult> {
    const result = await this.reactAgent.run(createTaskExecutionContext(input.context, input.plan, input.task));
    if (result.errorInfo) {
      return {
        taskId: input.task.taskId,
        taskStatus: "failed",
        output: result.errorInfo.message,
        error: result.errorInfo,
        executionFacts: result.executionFacts,
      };
    }
    return {
      taskId: input.task.taskId,
      taskStatus: "completed",
      output: typeof result.content?.data === "string"
        ? result.content.data
        : JSON.stringify(result.content?.data ?? {}),
      executionFacts: result.executionFacts,
    };
  }
}

function createTaskExecutionContext(
  context: AgentContext,
  plan: PlanStepResult,
  task: PlanTask,
): AgentContext {
  const runtimeContext = getRuntimeContext(context);
  return {
    ...context,
    runtimeContext: {
      ...runtimeContext,
      requestedMode: "react",
      userInput: {
        ...runtimeContext.userInput,
        content: {
          task: task.description,
          planSummary: plan.planSummary,
          taskId: task.taskId,
          taskType: task.type,
        },
      },
    },
  };
}
