import type { ArtifactMap } from "../../shared/types/common.js";
import type { ContractIssue, StageOutput } from "../../shared/contracts/pipeline.js";
import type { ShellResult } from "./shell-runner.js";

export interface ValidationInputArtifacts {
  project_path: string;
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
  shellResult: ShellResult,
  issues: ContractIssue[] = [],
): ValidationStageOutput {
  return {
    stageId: "validation",
    success: shellResult.passed,
    summary: shellResult.summary,
    artifacts: {
      artifactKey: "validation_result",
      projectPath: input.project_path,
      command: shellResult.command,
      exitCode: shellResult.exit_code,
      logs: shellResult.logs,
      passed: shellResult.passed,
      issues,
    },
  };
}
