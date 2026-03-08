import assert from "node:assert/strict";

import { PipelineService } from "../../src/workflow/pipeline/pipeline.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";
import { createRegistry } from "./pipeline-test-helpers.js";

export async function runPipelineStageEntryTests(workspaceRoot: string): Promise<void> {
  await testStageEntryRetrySemantics(workspaceRoot);
  await testStageEntryFromSpecifiedStage(workspaceRoot);
}

async function testStageEntryRetrySemantics(workspaceRoot: string): Promise<void> {
  const invocationContexts: StageRunContext[] = [];
  let shouldFail = true;
  const retryingStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      if (shouldFail) {
        return {
          stageId: context.stageId,
          status: "failed",
          success: false,
          summary: "First attempt failed.",
          artifacts: {},
        };
      }

      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Retry succeeded.",
        artifacts: {},
      };
    },
  };

  const pipeline = new PipelineService({
    registry: createRegistry({
      stageId: "implementation",
      launchRequirements: ["moduleDesign"],
      runner: retryingStage,
      nextStageId: null,
    }),
  });

  const taskId = await pipeline.launchTask({
    startStageId: "implementation",
    workspaceRoot,
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
  });

  assert.equal(pipeline.getTaskStatus(taskId), "failed");
  shouldFail = false;

  await pipeline.launchTask({
    taskId,
    triggerReason: "stage_entry",
    startStageId: "implementation",
    workspaceRoot,
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
  });

  assert.equal(invocationContexts.length, 2);
  assert.equal(invocationContexts[0]?.attempt, 1);
  assert.equal(invocationContexts[1]?.attempt, 2);
  assert.equal(pipeline.getTaskStatus(taskId), "completed");
}

async function testStageEntryFromSpecifiedStage(workspaceRoot: string): Promise<void> {
  const invocationContexts: StageRunContext[] = [];
  const stageA: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Stage A completed.",
        artifacts: {
          generatedSpec: "generated-spec.md",
        },
      };
    },
  };
  const stageB: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Stage B completed.",
        artifacts: {},
      };
    },
  };

  const pipeline = new PipelineService({
    registry: createRegistry(
      {
        stageId: "stage-a",
        launchRequirements: ["sourceDoc"],
        runner: stageA,
        nextStageId: "stage-b",
      },
      {
        stageId: "stage-b",
        launchRequirements: ["generatedSpec"],
        runner: stageB,
        nextStageId: null,
      },
    ),
  });

  const taskId = await pipeline.launchTask({
    startStageId: "stage-a",
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  await pipeline.launchTask({
    taskId,
    triggerReason: "stage_entry",
    startStageId: "stage-b",
    workspaceRoot,
    inputArtifacts: {
      generatedSpec: "generated-spec.md",
    },
  });

  assert.equal(invocationContexts.length, 3);
  assert.equal(invocationContexts[2]?.stageId, "stage-b");
  assert.equal(invocationContexts[2]?.attempt, 2);
}
