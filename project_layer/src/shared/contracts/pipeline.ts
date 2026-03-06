import type { ArtifactRef, ChangedFile, StageId, TaskId } from "../types/common.js";

export interface StageRunContext {
  taskId: TaskId;
  stageId: StageId;
  workspaceRoot: string;
  inputArtifacts: Record<string, ArtifactRef>;
  params?: Record<string, string>;
}

export interface StageOutput<TArtifacts = unknown> {
  stageId: StageId;
  success: boolean;
  summary: string;
  artifacts: TArtifacts;
}

export interface LaunchTaskRequest {
  startStage: StageId;
  inputRefs: Record<string, ArtifactRef>;
  targetModule?: string;
}

export interface ContractIssue {
  checkItem: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface ContractCheckResult {
  passed: boolean;
  summary: string;
  issues: ContractIssue[];
}

export interface IStageGenerator {
  run(context: StageRunContext): Promise<StageOutput>;
}

export interface IStageRunner {
  run(context: StageRunContext): Promise<StageOutput>;
}

export interface IContractChecker {
  check(context: StageRunContext, output: StageOutput): Promise<ContractCheckResult>;
}

export interface IPipeline {
  launchTask(request: LaunchTaskRequest): Promise<TaskId>;
}

export interface ImplementationStageArtifacts {
  changedFiles: ChangedFile[];
  summary: string;
}
