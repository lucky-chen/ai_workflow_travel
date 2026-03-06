import assert from "node:assert/strict";

import { PipelineService } from "../src/workflow/pipeline/pipeline.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";

export async function runPipelineTests(): Promise<void> {
  let receivedContext: StageRunContext | undefined;

  const implementationStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      receivedContext = context;
      return {
        stageId: context.stageId,
        success: true,
        summary: "Implementation stage executed.",
        artifacts: {
          changedFiles: [],
        },
      };
    },
  };

  const pipeline = new PipelineService({
    stages: {
      implementation: implementationStage,
    },
  });

  const taskId = await pipeline.launchTask({
    startStageId: "implementation",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
    params: {
      target: "demo",
    },
  });

  assert.equal(taskId.startsWith("task-"), true);
  assert.deepEqual(receivedContext, {
    taskId,
    stageId: "implementation",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
    params: {
      target: "demo",
    },
  });
  assert.deepEqual(pipeline.getLastOutput(taskId), {
    stageId: "implementation",
    success: true,
    summary: "Implementation stage executed.",
    artifacts: {
      changedFiles: [],
    },
  });

  const emptyPipeline = new PipelineService({ stages: {} });
  await assert.rejects(
    emptyPipeline.launchTask({
      startStageId: "missing-stage",
      workspaceRoot: "/workspace/demo",
      inputArtifacts: {},
    }),
    /No stage registered/,
  );
}
