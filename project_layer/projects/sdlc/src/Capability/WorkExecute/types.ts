import type { ExternalAction, ProjectFile } from "../../Runtime/Schema/runtime.js";
import type { WorkPlan, WorkPlanBatch } from "../../Runtime/Schema/work-plan.js";

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
  prompt: string;
  action: ExternalAction;
  summary: string;
}

export interface ParsedGenerationResult {
  prompt: string;
  summary: string;
}
