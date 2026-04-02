import type { AgentRunInput } from "../../interface/agent-api.js";

export interface PlanTask {
  name: string;
  description: string;
}

export interface PlanStepResult {
  planSummary: string;
  tasks: PlanTask[];
  validationError?: string;
}

export interface TaskExecutionResult {
  output: string;
  error: {
    code: number;
    message: string;
  };
  executionFacts?: {
    toolCalls: number;
    failedToolCalls: number;
  };
}

export interface ExecutionStepResult {
  tasks: PlanTask[];
  taskResults: TaskExecutionResult[];
  validationError?: string;
}

export interface TaskSummary {
  name: string;
  description: string;
  status: "completed" | "incomplete" | "failed";
  reason?: string;
  output?: string;
}

export interface Summary {
  conclusion: {
    completedCount: number;
    incompleteCount: number;
    failedCount: number;
  };
  validationError?: string;
  tasks: TaskSummary[];
}

export interface ObserveStepInput {
  plan: PlanStepResult;
  executionResult: ExecutionStepResult;
  priorObservation?: Summary;
}

export interface ITaskExecutor {
  execute(input: {
    plan: PlanStepResult;
    task: PlanTask;
    stepIndex: number;
    context: AgentRunInput;
  }): Promise<TaskExecutionResult>;
}
