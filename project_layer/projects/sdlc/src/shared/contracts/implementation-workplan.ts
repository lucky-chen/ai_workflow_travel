export type ImplementationWorkPlanStatus = "not_started" | "in_progress" | "completed";

export interface ImplementationWorkPlanBatch {
  batchId: string;
  title: string;
  status: ImplementationWorkPlanStatus;
  tasks: string[];
}

export interface ImplementationWorkPlanStep {
  stepId: string;
  title: string;
  status: ImplementationWorkPlanStatus;
  architectureModulesInScope: string[];
  batches: ImplementationWorkPlanBatch[];
}

export interface ImplementationWorkPlan {
  steps: ImplementationWorkPlanStep[];
}
