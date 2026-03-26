import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ArtifactStoreService } from "../../src/Data/artifact-store.js";
import { RequirementDesignUpdateRuntimeUnit } from "../../src/Capability/RequirementDesign/requirement-update.js";
import { InMemoryChangeGate } from "../../src/SDK/QualityControl/Gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { continueDocumentUpdateLoop } from "../../src/Runtime/external-update-loop.js";
import type { ILlmExecutor } from "../../src/SDK/AgentRuntime/LlmExecutor/llm-executor.js";

export async function runExternalUpdateLoopTests(): Promise<void> {
  await testRequirementUpdateLoopRefreshesArtifactsForContinuation();
  await testRequirementUpdateLoopRejectsMissingTargetArtifactBinding();
}

async function testRequirementUpdateLoopRefreshesArtifactsForContinuation(): Promise<void> {
  const workspaceRoot = await createTempDir("external-update-loop-workspace-");
  const storageRoot = await createTempDir("external-update-loop-storage-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Existing Requirement\n",
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new RequirementDesignUpdateRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createUnusedLlmExecutor(),
    );

    const initialResult = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "requirement_design_update",
        params: {
          userComment: "Add one more scenario.",
        },
      },
      {
        workspaceRoot,
        runId: "requirement-update-loop",
      },
    );

    const loopResult = await continueDocumentUpdateLoop(
      new InMemoryChangeGate({
        decision: {
          action: "apply",
          summary: "Approved refreshed requirement document.",
        },
      }),
      {
        taskId: "requirement-update-loop",
        executionUnitId: "requirement_design_update",
        initialResult,
        externalActionResult: {
          status: "success",
          targetPath: workspaceRoot,
          changedFiles: [
            {
              path: "sdlc/docs/Requirement.md",
              operation: "update",
              content: "# Updated Requirement\n",
            },
          ],
          updatedArtifacts: [
            {
              artifactKey: "requirement_design",
              filePath: "sdlc/docs/Requirement.md",
              content: "# Updated Requirement\n",
            },
          ],
        },
      },
    );

    assert.deepEqual(loopResult, {
      accepted: true,
      summary: "Approved refreshed requirement document.",
      continuation: {
        branch: "continue",
        targetPath: workspaceRoot,
        resumeInput: {
          requirement_design: "# Updated Requirement\n",
        },
        comment: undefined,
      },
    });
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}

async function testRequirementUpdateLoopRejectsMissingTargetArtifactBinding(): Promise<void> {
  const workspaceRoot = await createTempDir("external-update-loop-missing-artifact-");
  const storageRoot = await createTempDir("external-update-loop-missing-artifact-storage-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Existing Requirement\n",
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new RequirementDesignUpdateRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createUnusedLlmExecutor(),
    );

    const initialResult = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "requirement_design_update",
        params: {
          userComment: "Add one more scenario.",
        },
      },
      {
        workspaceRoot,
        runId: "requirement-update-loop-missing-artifact",
      },
    );

    await assert.rejects(
      () => continueDocumentUpdateLoop(
        new InMemoryChangeGate(),
        {
          taskId: "requirement-update-loop-missing-artifact",
          executionUnitId: "requirement_design_update",
          initialResult,
          externalActionResult: {
            status: "success",
            targetPath: workspaceRoot,
            updatedArtifacts: [
              {
                artifactKey: "work_plan",
                filePath: "sdlc/docs/work_plan.yaml",
                content: "version: 2\n",
              },
            ],
          },
        },
      ),
      /missing refreshed artifact "requirement_design"/i,
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}

function createUnusedLlmExecutor(): ILlmExecutor {
  return {
    async execute() {
      throw new Error("Requirement update loop test must not call llmExecutor.");
    },
  };
}

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function removeTempDir(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}
