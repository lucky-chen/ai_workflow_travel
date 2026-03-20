import assert from "node:assert/strict";

import { InMemoryChangeGate } from "../../src/SDK/QualityControl/Gate/change-gate.js";
import { buildExternalChangeReviewRequest, reviewExternalActionResult } from "../../src/Runtime/gate-continuation.js";

export async function runGateContinuationTests(): Promise<void> {
  await testApplyDecisionContinuesWithResumeInput();
  await testRejectDecisionStopsContinuation();
  await testWaitDecisionReturnsResumableState();
  await testReviewRequestUsesChangedFiles();
}

async function testApplyDecisionContinuesWithResumeInput(): Promise<void> {
  const result = await reviewExternalActionResult(
    new InMemoryChangeGate({
      decision: {
        action: "apply",
        summary: "Approved for continuation.",
      },
    }),
    {
      taskId: "task-apply",
      executionUnitId: "work_execute",
      summary: "Review external changes.",
      externalActionResult: {
        status: "success",
        targetPath: "/tmp/workspace",
        updatedArtifacts: [
          {
            artifactKey: "work_plan",
            filePath: "sdlc/docs/work_plan.yaml",
            content: "version: 2\n",
          },
        ],
      },
    },
  );

  assert.deepEqual(result, {
    accepted: true,
    summary: "Approved for continuation.",
    continuation: {
      branch: "continue",
      targetPath: "/tmp/workspace",
      resumeInput: {
        work_plan: "version: 2\n",
      },
      comment: undefined,
    },
  });
}

async function testRejectDecisionStopsContinuation(): Promise<void> {
  const result = await reviewExternalActionResult(
    new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Rejected external changes.",
        comment: "Contract failed.",
      },
    }),
    {
      taskId: "task-reject",
      executionUnitId: "work_execute",
      summary: "Review rejected external changes.",
      externalActionResult: {
        status: "success",
        targetPath: "/tmp/workspace",
        resumeInput: {
          work_plan: "version: 2\n",
        },
      },
    },
  );

  assert.deepEqual(result, {
    accepted: false,
    summary: "Rejected external changes.",
    continuation: {
      branch: "reject",
      targetPath: "/tmp/workspace",
      comment: "Contract failed.",
    },
  });
}

async function testWaitDecisionReturnsResumableState(): Promise<void> {
  const result = await reviewExternalActionResult(
    new InMemoryChangeGate({
      decision: {
        action: "wait",
        summary: "Waiting for manual follow-up.",
        comment: "Needs one more review pass.",
      },
    }),
    {
      taskId: "task-wait",
      executionUnitId: "work_execute",
      summary: "Review paused external changes.",
      externalActionResult: {
        status: "success",
        targetPath: "/tmp/workspace",
        resumeInput: {
          requirement_design: "# Requirement\n",
        },
      },
    },
  );

  assert.deepEqual(result, {
    accepted: false,
    summary: "Waiting for manual follow-up.",
    continuation: {
      branch: "wait",
      targetPath: "/tmp/workspace",
      resumeInput: {
        requirement_design: "# Requirement\n",
      },
      comment: "Needs one more review pass.",
    },
  });
}

async function testReviewRequestUsesChangedFiles(): Promise<void> {
  const reviewRequest = buildExternalChangeReviewRequest({
    taskId: "task-request",
    executionUnitId: "work_execute",
    summary: "Review changed files.",
    externalActionResult: {
      status: "success",
      targetPath: "/tmp/workspace",
      changedFiles: [
        {
          path: "src/index.ts",
          operation: "update",
          content: "export const value = 1;\n",
        },
      ],
    },
  });

  assert.deepEqual(reviewRequest, {
    taskId: "task-request",
    executionUnitId: "work_execute",
    summary: "Review changed files.",
    changedPaths: ["src/index.ts"],
    changedFiles: [
      {
        path: "src/index.ts",
        operation: "update",
        content: "export const value = 1;\n",
      },
    ],
  });
}
