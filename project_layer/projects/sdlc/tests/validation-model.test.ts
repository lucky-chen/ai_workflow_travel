import assert from "node:assert/strict";

import {
  buildValidationStageOutput,
  parseValidationInputArtifacts,
} from "../src/workflow/validation/validation-shapes.js";
import type { ShellResult } from "../src/workflow/validation/shell-runner.js";

export async function runValidationModelTests(): Promise<void> {
  await testParseValidationInputArtifactsRequiresProjectPath();
  await testParseValidationInputArtifactsReturnsNormalizedShape();
  await testBuildValidationStageOutputShapesValidationResult();
}

async function testParseValidationInputArtifactsRequiresProjectPath(): Promise<void> {
  assert.throws(
    () => parseValidationInputArtifacts({}),
    /Missing required input artifact "project_path"\./,
  );
}

async function testParseValidationInputArtifactsReturnsNormalizedShape(): Promise<void> {
  const input = parseValidationInputArtifacts({
    project_path: "  /tmp/validation-project  ",
  });

  assert.deepEqual(input, {
    project_path: "/tmp/validation-project",
  });
}

async function testBuildValidationStageOutputShapesValidationResult(): Promise<void> {
  const shellResult: ShellResult = {
    passed: false,
    summary: "Validation failed: unit tests returned exit code 1.",
    command: "npm test",
    exit_code: 1,
    logs: "1 test failed",
  };

  const output = buildValidationStageOutput(
    { project_path: "/tmp/validation-project" },
    shellResult,
    [
      {
        checkItem: "shell_test_execution",
        message: "Shell test command exited with code 1.",
        severity: "high",
      },
    ],
  );

  assert.deepEqual(output, {
    stageId: "validation",
    success: false,
    summary: "Validation failed: unit tests returned exit code 1.",
    artifacts: {
      artifactKey: "validation_result",
      projectPath: "/tmp/validation-project",
      command: "npm test",
      exitCode: 1,
      logs: "1 test failed",
      passed: false,
      issues: [
        {
          checkItem: "shell_test_execution",
          message: "Shell test command exited with code 1.",
          severity: "high",
        },
      ],
    },
  });
}
