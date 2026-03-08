// Shared pipeline contract: defines stage runtime input, output, and workflow-facing interfaces.
import type {
  ArtifactMap,
  ChangedFile,
  IssueSeverity,
  StageId,
  StringMap,
  TaskId,
} from "../types/common.js";

export interface StageRunContext {
  taskId: TaskId;
  stageId: StageId;
  attempt: number;
  workspaceRoot: string;
  inputArtifacts: ArtifactMap;
  params?: StringMap;
}

export interface StageOutput<TArtifacts = unknown> {
  stageId: StageId;
  status?: "completed" | "failed";
  success: boolean;
  summary: string;
  artifacts: TArtifacts;
}

export type TaskStatus = "pending" | "running" | "failed" | "completed";

export interface TaskRecord {
  taskId: TaskId;
  startStageId: StageId;
  currentStageId: StageId;
  attempt: number;
  status: TaskStatus;
  workspaceRoot: string;
  inputArtifacts: ArtifactMap;
  lastOutput?: StageOutput;
}

export interface LaunchTaskRequest {
  startStageId: StageId;
  taskId?: TaskId;
  triggerReason?: "new_run" | "stage_entry";
  workspaceRoot: string;
  inputArtifacts: ArtifactMap;
  params?: StringMap;
  targetModule?: string;
}

export interface ContractIssue {
  checkItem: string;
  message: string;
  severity: IssueSeverity;
}

export interface ContractCheckResult {
  passed: boolean;
  summary: string;
  issues: ContractIssue[];
}

export interface IStageGenerator<TOutput extends StageOutput = StageOutput> {
  run(context: StageRunContext): Promise<TOutput>;
}

export interface IStageRunner {
  run(context: StageRunContext): Promise<StageOutput>;
}

export interface StageDefinition {
  stageId: StageId;
  launchRequirements: string[];
  runner: IStageRunner;
  nextStageId?: StageId | null;
}

export interface StageRunnerSharedDependencies {
  traceRecorder?: import("./trace.js").ITraceRecorder;
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
