import type { ArtifactMap } from "../types/common.js";
import type { ContractIssue, StageOutput } from "./pipeline.js";

export interface ValidationInputArtifacts {
  project_path: string;
}

export interface ShellTestResult {
  passed: boolean;
  summary: string;
  command: string;
  exit_code: number;
  logs?: string;
}

export interface ValidationStageArtifacts {
  artifactKey: "validation_result";
  projectPath: string;
  command: string;
  exitCode: number;
  logs?: string;
  passed: boolean;
  issues: ContractIssue[];
}

export type ValidationStageOutput = StageOutput<ValidationStageArtifacts>;

export function parseValidationInputArtifacts(inputArtifacts: ArtifactMap): ValidationInputArtifacts {
  const projectPath = inputArtifacts.project_path?.trim();
  if (!projectPath) {
    throw new Error('Missing required input artifact "project_path".');
  }

  return {
    project_path: projectPath,
  };
}

export function buildValidationStageOutput(
  input: ValidationInputArtifacts,
  shellTestResult: ShellTestResult,
  issues: ContractIssue[] = [],
): ValidationStageOutput {
  return {
    stageId: "validation",
    success: shellTestResult.passed,
    summary: shellTestResult.summary,
    artifacts: {
      artifactKey: "validation_result",
      projectPath: input.project_path,
      command: shellTestResult.command,
      exitCode: shellTestResult.exit_code,
      logs: shellTestResult.logs,
      passed: shellTestResult.passed,
      issues,
    },
  };
}
