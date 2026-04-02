import type { AgentRunInput } from "../../interface/agent-api.js";

export type PlanTaskType = "direct" | "react";
export type PlanTaskStatus = "pending" | "completed" | "failed" | "blocked";

export interface PlanTask {
  taskId: string;
  description: string;
  type: PlanTaskType;
  status: PlanTaskStatus;
  dependsOn?: string[];
}

export interface PlanStepResult {
  planSummary: string;
  tasks: PlanTask[];
  finalAnswer?: string;
}

export interface TaskExecutionResult {
  taskId: string;
  taskStatus: Exclude<PlanTaskStatus, "pending">;
  output?: string;
  error?: {
    code: string;
    message: string;
  };
  executionFacts?: {
    toolCalls: number;
    failedToolCalls: number;
  };
}

export interface ExecutionStepResult {
  planSummary: string;
  tasks: PlanTask[];
  taskExecutions: TaskExecutionResult[];
  finalAnswer?: string;
}

export interface ObserveStepInput {
  plan: PlanStepResult;
  executionResult: ExecutionStepResult;
  priorObservation?: string;
}

export interface ITaskExecutor {
  execute(input: {
    plan: PlanStepResult;
    task: PlanTask;
    stepIndex: number;
    context: AgentRunInput;
  }): Promise<TaskExecutionResult>;
}
