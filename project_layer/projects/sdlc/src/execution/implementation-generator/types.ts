// Implementation generator types: local models used by the implementation generation workflow.
import type { ChangedFile, ProjectFile } from "../../shared/types/common.js";

export interface ModuleDesignDoc {
  moduleName: string;
  content: string;
}

export interface ProjectContext {
  rootPath: string;
  relevantFiles: ProjectFile[];
}

export interface ImplementationWorkPlanInput {
  ref: string;
  content: string;
}

export interface CurrentStepInput {
  stepId: string;
  raw: string;
}

export interface UpstreamImplementationContext {
  requirementDocument: string;
  architectureDocument: string;
  moduleDesignDocuments: ModuleDesignDoc[];
}

export interface PreparedStepContext {
  workplan: ImplementationWorkPlanInput;
  currentStep: CurrentStepInput;
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
