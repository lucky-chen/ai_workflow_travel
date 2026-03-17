import type {
  ArtifactMap,
  ChangedFile,
  ExecutionUnitId,
  IssueSeverity,
  StringMap,
  TaskId,
} from "../Schema/runtime.js";

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

export function hasArtifactValue(artifacts: ArtifactMap, artifactKey: string): boolean {
  return typeof getArtifactValue(artifacts, artifactKey) === "string";
}

export interface ExecutionContext {
  taskId: TaskId;
  runId?: string;
  executionUnitId: ExecutionUnitId;
  attempt: number;
  workspaceRoot: string;
  inputArtifacts: ArtifactMap;
  params?: StringMap;
}

export interface ExecutionUnitResult<TArtifacts = unknown> {
  executionUnitId: ExecutionUnitId;
  status?: "completed" | "failed";
  success: boolean;
  summary: string;
  artifacts: TArtifacts;
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

export interface IExecutionUnitGenerator<TOutput extends ExecutionUnitResult = ExecutionUnitResult> {
  run(context: ExecutionContext): Promise<TOutput>;
}

export interface IContractChecker {
  check(context: ExecutionContext, output: ExecutionUnitResult): Promise<ContractCheckResult>;
}

export interface WorkExecuteArtifacts {
  changedFiles: ChangedFile[];
  summary: string;
}
