// Work-execute generator types: local models used by the work-execute workflow.
import type { ChangedFile, ProjectFile } from "../../../Runtime/Schema/runtime.js";
import type { WorkPlan, WorkPlanBatch } from "../../../Runtime/Schema/work-plan.js";

export interface ItemDesignDoc {
  itemName: string;
  content: string;
}

export interface ProjectContext {
  rootPath: string;
  relevantFiles: ProjectFile[];
}

export interface UpstreamWorkExecuteContext {
  requirementDocument: string;
  architectureDocument: string;
  itemDesignDocuments: ItemDesignDoc[];
}

export interface PreparedStepContext {
  workplanRef: string;
  workplan: WorkPlan;
  currentBatch: WorkPlanBatch;
  upstreamContext: UpstreamWorkExecuteContext;
}

export interface PromptBuildInput {
  preparedStepContext: PreparedStepContext;
  projectContext: ProjectContext;
}

export interface ApplyResult {
  changedFiles: ChangedFile[];
  summary: string;
}

export interface ParsedGenerationResult {
  changedFiles: ChangedFile[];
  summary: string;
}
