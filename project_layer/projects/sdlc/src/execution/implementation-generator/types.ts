// Implementation generator types: local models used by the implementation generation workflow.
import type { ChangedFile, ProjectFile } from "../../shared/types/common.js";
import type { ImplementationWorkPlan, ImplementationWorkPlanBatch } from "../../shared/contracts/implementation-workplan.js";

export interface ModuleDesignDoc {
  moduleName: string;
  content: string;
}

export interface ProjectContext {
  rootPath: string;
  relevantFiles: ProjectFile[];
}

export interface UpstreamImplementationContext {
  requirementDocument: string;
  architectureDocument: string;
  moduleDesignDocuments: ModuleDesignDoc[];
}

export interface PreparedStepContext {
  workplanRef: string;
  workplan: ImplementationWorkPlan;
  currentBatch: ImplementationWorkPlanBatch;
  upstreamContext: UpstreamImplementationContext;
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
