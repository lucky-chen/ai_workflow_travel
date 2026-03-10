// Shared pipeline contract: defines stage runtime input, output, and workflow-facing interfaces.
import type {
  ArtifactMap,
  ChangedFile,
  FilePath,
  IssueSeverity,
  ReviewAction,
  StageId,
  StringMap,
  TaskId,
  TraceRef,
} from "../types/common.js";

export const TRACE_EVENT_TYPES = {
  agentExecutionFinished: "agent_execution_finished",
  agentExecutionStarted: "agent_execution_started",
  agentObservationFinished: "agent_observation_finished",
  agentPlanCreated: "agent_plan_created",
  artifactPersisted: "artifact_persisted",
  contractChecked: "contract_checked",
  gateReviewed: "gate_reviewed",
  generationFinished: "generation_finished",
  generationStarted: "generation_started",
  llmExecutionFinished: "llm_execution_finished",
  llmExecutionStarted: "llm_execution_started",
  stageFailed: "stage_failed",
  stageStarted: "stage_started",
  stepCompleted: "step_completed",
  taskFinished: "task_finished",
  taskLaunchRequested: "task_launch_requested",
  taskStarted: "task_started",
  validationFinished: "validation_finished",
} as const;

export type TraceEventType = (typeof TRACE_EVENT_TYPES)[keyof typeof TRACE_EVENT_TYPES];

export interface StageRunContext {
  taskId: TaskId;
  runId?: string;
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
  runId?: string;
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
  runId?: string;
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

export interface WriteArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  filePath: FilePath;
  content: string;
  workspaceRoot?: string;
}

export interface GetArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  filePath: FilePath;
}

export interface ListArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  rootDir: FilePath;
}

export interface IArtifactStore {
  writeArtifact(request: WriteArtifactRequest): Promise<boolean>;
  getArtifact(request: GetArtifactRequest): Promise<string>;
  listArtifacts(query: ListArtifactRequest): Promise<string[]>;
}

export interface TraceEvent {
  runId?: string;
  stageId?: StageId;
  caller: string;
  eventType: TraceEventType;
  summary: string;
  category?: string;
  metadata?: StringMap;
  payload?: Record<string, unknown>;
}

export interface TraceScope {
  taskId: TaskId;
  runId: string;
}

export interface ITraceRecorder {
  recordTrace(event: TraceEvent): Promise<TraceRef>;
}

export interface ChangeReviewRequest {
  taskId: TaskId;
  stageId: StageId;
  summary: string;
  changedPaths: string[];
  changedFiles: ChangedFile[];
}

export interface GateDecision {
  action: ReviewAction;
  summary: string;
  comment?: string;
}

export interface IChangeGate {
  review(changeRequest: ChangeReviewRequest): Promise<GateDecision>;
}

export interface IStageGenerator<TOutput extends StageOutput = StageOutput> {
  run(context: StageRunContext): Promise<TOutput>;
}

export interface IStageRunner {
  run(context: StageRunContext): Promise<StageOutput>;
}

export interface StageContinuationContext {
  taskId: TaskId;
  stageId: StageId;
  nextStageId?: StageId | null;
  attempt: number;
  workspaceRoot: string;
  inputArtifacts: ArtifactMap;
  stageOutput: StageOutput;
  params?: StringMap;
  mergeInputArtifacts(current: ArtifactMap, output: StageOutput): ArtifactMap;
  resolveStageStatus(output: StageOutput): "completed" | "failed";
  updateTaskAfterStageRun(context: StageRunContext, output: StageOutput): void;
  onStageFailure(stageId: StageId, inputArtifacts: ArtifactMap, summary: string): Promise<void>;
}

export interface StageContinuationResult {
  nextInputArtifacts: ArtifactMap;
  nextStageId?: StageId;
}

export interface IStageContinuationHandler {
  continue(context: StageContinuationContext): Promise<StageContinuationResult>;
}

export interface StageDefinition {
  stageId: StageId;
  launchRequirements: string[];
  runner: IStageRunner;
  nextStageId?: StageId | null;
  continuation?: IStageContinuationHandler;
}

export interface StageRunnerSharedDependencies {
  traceRecorder?: ITraceRecorder;
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
