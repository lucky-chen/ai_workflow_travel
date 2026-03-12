import assert from "node:assert/strict";

import { ValidationStageRunner } from "../../src/workflow/stage-runners/validation-stage-runner.js";
import type { ShellResult } from "../../src/workflow/shell-runner.js";

export async function runValidationModelTests(): Promise<void> {
  await testValidationUsesWorkspaceRoot();
  await testBuildValidationStageOutputShapesValidationResult();
}

async function testValidationUsesWorkspaceRoot(): Promise<void> {
  const runner = new ValidationStageRunner({
    shellRunner: new MockShellRunner({
      passed: true,
      summary: 'Shell command passed: cd "/tmp/validation-workspace" && npm test',
      command: 'cd "/tmp/validation-workspace" && npm test',
      exit_code: 0,
    }),
  });

  const output = await runner.run({
    taskId: "task-validation",
    stageId: "validation",
    attempt: 1,
    workspaceRoot: "/tmp/validation-workspace",
    inputArtifacts: {},
  });

  assert.equal(output.artifacts.projectPath, "/tmp/validation-workspace");
}

async function testBuildValidationStageOutputShapesValidationResult(): Promise<void> {
  const runner = new ValidationStageRunner({
    shellRunner: new MockShellRunner({
      passed: false,
      summary: "Validation failed: unit tests returned exit code 1.",
      command: "npm test",
      exit_code: 1,
      logs: "1 test failed",
    }),
  });

  const output = await runner.run({
    taskId: "task-validation",
    stageId: "validation",
    attempt: 1,
    workspaceRoot: "/tmp/validation-workspace",
    inputArtifacts: {},
    params: {
      validationCommand: "npm test",
    },
  });

  assert.deepEqual(output, {
    stageId: "validation",
    success: false,
    summary: "Validation failed: unit tests returned exit code 1.",
    artifacts: {
      artifactKey: "validation_result",
      projectPath: "/tmp/validation-workspace",
      command: "npm test",
      exitCode: 1,
      logs: "1 test failed",
      passed: false,
    },
  });
}

class MockShellRunner {
  constructor(private readonly result: ShellResult) {}

  async run(_command: string): Promise<ShellResult> {
    return this.result;
  }
}
