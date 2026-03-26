export type WorkPlanStatus = "not_started" | "in_progress" | "completed";

export interface WorkPlanBatch {
  batchId: string;
  title: string;
  status: WorkPlanStatus;
  tasks: string[];
}

export interface WorkPlanStep {
  stepId: string;
  title: string;
  status: WorkPlanStatus;
  architectureModulesInScope: string[];
  batches: WorkPlanBatch[];
}

export interface WorkPlan {
  steps: WorkPlanStep[];
}
