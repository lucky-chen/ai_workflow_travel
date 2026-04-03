import type { AgentRunInput, IAgent } from "../../interface/agent-api.js";
import type { ITaskExecutor, PlanStepResult, PlanTask, TaskExecutionResult } from "./peo_types.js";

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
        output: result.errorInfo.message ?? "Agent execution failed.",
        error: {
          code: 1,
          message: result.errorInfo.message ?? "Agent execution failed.",
        },
      };
    }
    return {
      output: typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content ?? {}),
      error: {
        code: 0,
        message: "",
      },
    };
  }
}

function createTaskExecutionContext(
  input: AgentRunInput,
  plan: PlanStepResult,
  task: PlanTask,
  _stepIndex: number,
): AgentRunInput {
  void _stepIndex;
  return {
    userInput: {
      task: task.description,
      taskName: task.name,
      planSummary: plan.planSummary,
    },
  };
}
