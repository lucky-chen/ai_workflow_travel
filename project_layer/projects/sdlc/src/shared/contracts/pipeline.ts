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

export const STAGE_ID_ALIASES = {
  architecture_design_generate: "architecture_design",
  architecture_design_update: "architecture_design",
  architecture_design_contract: "architecture_design",
  requirement_design: "requirement_interpretation",
  requirement_design_generate: "requirement_interpretation",
  requirement_design_update: "requirement_interpretation",
  requirement_design_contract: "requirement_interpretation",
  item_design: "module_design",
  item_design_generate: "module_design",
  item_design_update: "module_design",
  item_design_contract: "module_design",
  work_plan: "implementation_plan",
  work_plan_generate: "implementation_plan",
  work_plan_update: "implementation_plan",
  work_plan_contract: "implementation_plan",
  work_execute: "implementation_execution",
  work_execute_contract: "validation",
} as const satisfies Record<string, StageId>;

export const CANONICAL_STAGE_IDS = {
  requirement_interpretation: "requirement_design_generate",
  architecture_design: "architecture_design_generate",
  module_design: "item_design_generate",
  implementation_plan: "work_plan_generate",
  implementation_execution: "work_execute",
  validation: "work_execute_contract",
} as const satisfies Record<string, StageId>;

export function resolveStageIdAlias(stageId: StageId): StageId {
  return STAGE_ID_ALIASES[stageId as keyof typeof STAGE_ID_ALIASES] ?? stageId;
}

export function toCanonicalStageId(stageId: StageId): StageId {
  return CANONICAL_STAGE_IDS[stageId as keyof typeof CANONICAL_STAGE_IDS] ?? stageId;
}

export const ARTIFACT_KEY_ALIASES = {
  architecture_design: ["architecture_document"],
  item_design_documents: ["module_design_documents"],
  parsed_work_plan: ["parsed_implementation_workplan"],
  requirement_design: ["requirement_document"],
  work_execute_completed: ["implementation_execution_completed"],
  work_plan: ["implementation_workplan"],
} as const satisfies Record<string, readonly string[]>;

export function getArtifactValue(
  artifacts: ArtifactMap,
  artifactKey: string,
): string | undefined {
  const directValue = artifacts[artifactKey];
  if (typeof directValue === "string") {
    return directValue;
  }

  const aliases = ARTIFACT_KEY_ALIASES[artifactKey as keyof typeof ARTIFACT_KEY_ALIASES] ?? [];
  for (const alias of aliases) {
    const aliasValue = artifacts[alias];
    if (typeof aliasValue === "string") {
      return aliasValue;
    }
  }

  return undefined;
}

export function hasArtifactValue(
  artifacts: ArtifactMap,
  artifactKey: string,
): boolean {
  return typeof getArtifactValue(artifacts, artifactKey) === "string";
}

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
  executionUnit?: string;
  runtimeMode?: "direct" | "compose";
  composeMode?: "standard" | "from";
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
  executionUnit?: string;
  runtimeMode?: "direct" | "compose";
  composeMode?: "standard" | "from";
  triggerReason?: "new_run" | "stage_entry";
  stopAfterCurrentStage?: boolean;
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
  workspaceRoot?: string;
}

export interface ListArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  rootDir: FilePath;
  workspaceRoot?: string;
}

export interface IArtifactStore {
  writeArtifact(request: WriteArtifactRequest): Promise<boolean>;
  getArtifact(request: GetArtifactRequest): Promise<string>;
  listArtifacts(query: ListArtifactRequest): Promise<string[]>;
}

export interface TraceEvent {
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
