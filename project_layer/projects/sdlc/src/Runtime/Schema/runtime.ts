export type TaskId = string;
export type ExecutionUnitId = string;
export type ArtifactRef = string;
export type FilePath = string;
export type TraceRef = string;
export type StringMap = Readonly<Record<string, string>>;
export type ArtifactMap = Readonly<Record<string, ArtifactRef>>;
export type IssueSeverity = "low" | "medium" | "high";
export type ReviewAction = "apply" | "reject" | "wait";
export type ChangeOperation = "create" | "update" | "delete";

export interface ProjectFile {
  path: FilePath;
  content: string;
}

export interface ChangedFile {
  path: FilePath;
  operation: ChangeOperation;
  content?: string;
}

export interface ComposeRuntimeRequest {
  mode: "compose";
  composeMode: "standard" | "from";
  entryUnit?: string;
  params?: StringMap;
}

export interface UnitRuntimeRequest {
  mode: "unit";
  executionUnitId: string;
  params?: StringMap;
}

export type RuntimeRequest = ComposeRuntimeRequest | UnitRuntimeRequest;

export interface RuntimeContext {
  workspaceRoot: string;
  runId: string;
}

export interface RuntimeInput {
  request: RuntimeRequest;
  context: RuntimeContext;
}

export interface ExternalActionTargetArtifact {
  artifactKey: string;
  filePath: string;
}

export interface DocumentUpdateActionPayload {
  handoffType: "document_update";
  prompt: string;
  targetArtifact: ExternalActionTargetArtifact;
}

export interface ExternalActionUpdatedArtifact {
  artifactKey: string;
  filePath: string;
  content?: string;
}

export interface ExternalAction {
  tool: "external_plugin" | "external_execution";
  operation: string;
  targetPath: string;
  payload?: DocumentUpdateActionPayload | Record<string, unknown>;
}

export interface ExternalActionResult {
  status: "success" | "failed";
  targetPath: string;
  changedFiles?: ChangedFile[];
  updatedArtifacts?: ExternalActionUpdatedArtifact[];
  resumeInput?: ArtifactMap;
  payload?: Record<string, unknown>;
  diagnostics?: Array<Record<string, unknown>>;
}

export interface RuntimeResult {
  accepted: boolean;
  summary: string;
  externalAction?: ExternalAction;
}
