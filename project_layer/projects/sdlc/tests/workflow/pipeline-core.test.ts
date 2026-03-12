import assert from "node:assert/strict";

import { InMemoryTraceRecorder } from "../../src/quality-gate/trace-recorder.js";
import { PipelineService } from "../../src/workflow/pipeline/pipeline.js";
import { StageRegistry } from "../../src/workflow/pipeline/stage-registry.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";
import { createRegistry } from "./pipeline-test-helpers.js";

export async function runPipelineCoreTests(workspaceRoot: string): Promise<void> {
  await testSingleStageLaunch(workspaceRoot);
  await testMissingStageLaunch(workspaceRoot);
  await testMissingRequiredArtifact(workspaceRoot);
  await testDuplicateStageRegistration();
  await testStageContinuationAndMerge(workspaceRoot);
  await testSingleStepStopsAfterCurrentStage(workspaceRoot);
  await testStageDefinitionContinuationOverridesDefaultFlow(workspaceRoot);
  await testFailureStopsContinuation(workspaceRoot);
  await testInvalidNextStageValidation(workspaceRoot);
}

async function testSingleStageLaunch(workspaceRoot: string): Promise<void> {
  let receivedContext: StageRunContext | undefined;
  const implementationStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      receivedContext = context;
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Implementation stage executed.",
        artifacts: {
          changedFiles: [],
        },
      };
    },
  };

  const registry = new StageRegistry();
  registry.register({
    stageId: "implementation",
    launchRequirements: ["moduleDesign"],
    runner: implementationStage,
    nextStageId: null,
  });
  const traceRecorder = new InMemoryTraceRecorder();
  const pipeline = new PipelineService({ registry, traceRecorder });

  const taskId = await pipeline.launchTask({
    startStageId: "implementation",
    workspaceRoot,
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
    params: {
      target: "demo",
    },
  });

  assert.equal(taskId.startsWith("task-"), true);
  assert.match(receivedContext?.runId ?? "", /^\d+$/);
  assert.deepEqual(receivedContext, {
    taskId,
    runId: receivedContext?.runId,
    stageId: "implementation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
    params: {
      target: "demo",
    },
  });
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), ["task_started", "task_finished"]);
  assert.equal(pipeline.getTaskStatus(taskId), "completed");
}

async function testMissingStageLaunch(workspaceRoot: string): Promise<void> {
  const emptyRegistry = new StageRegistry();
  const emptyPipeline = new PipelineService({ registry: emptyRegistry });
  await assert.rejects(
    emptyPipeline.launchTask({
      startStageId: "missing-stage",
      workspaceRoot,
      inputArtifacts: {},
    }),
    /No stage definition registered/,
  );
}

async function testMissingRequiredArtifact(workspaceRoot: string): Promise<void> {
  const implementationStage = createCompletedStage("Implementation stage executed.");
  const pipeline = new PipelineService({
    registry: createRegistry({
      stageId: "implementation",
      launchRequirements: ["moduleDesign"],
      runner: implementationStage,
      nextStageId: null,
    }),
  });

  await assert.rejects(
    pipeline.launchTask({
      startStageId: "implementation",
      workspaceRoot,
      inputArtifacts: {},
    }),
    /Missing required input artifact "moduleDesign"/,
  );
}

async function testDuplicateStageRegistration(): Promise<void> {
  const implementationStage = createCompletedStage("Implementation stage executed.");
  const duplicateRegistry = new StageRegistry();
  duplicateRegistry.register({
    stageId: "implementation",
    launchRequirements: [],
    runner: implementationStage,
    nextStageId: null,
  });
  assert.throws(
    () =>
      duplicateRegistry.register({
        stageId: "implementation",
        launchRequirements: [],
        runner: implementationStage,
        nextStageId: null,
      }),
    /Stage definition already registered/,
  );
}

async function testStageContinuationAndMerge(workspaceRoot: string): Promise<void> {
  const continuedContexts: StageRunContext[] = [];
  const stageA: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      continuedContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Stage A completed.",
        artifacts: {
          generatedSpec: "generated-spec.md",
          ignoredObject: { nested: true },
        },
      };
    },
  };
  const stageB: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      continuedContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Stage B completed.",
        artifacts: {},
      };
    },
  };
  const continuationTraceRecorder = new InMemoryTraceRecorder();
  const continuationPipeline = new PipelineService({
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
    traceRecorder: continuationTraceRecorder,
  });
  const continuedTaskId = await continuationPipeline.launchTask({
    startStageId: "stage-a",
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(continuedContexts.length, 2);
  assert.match(continuedContexts[1]?.runId ?? "", /^\d+$/);
  assert.deepEqual(continuedContexts[1], {
    taskId: continuedTaskId,
    runId: continuedContexts[1]?.runId,
    stageId: "stage-b",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
      generatedSpec: "generated-spec.md",
    },
    params: undefined,
  });
  assert.deepEqual(continuationTraceRecorder.getEvents().map((entry) => entry.event.eventType), ["task_started", "task_finished"]);
  assert.equal(continuationPipeline.getTaskStatus(continuedTaskId), "completed");
}

async function testFailureStopsContinuation(workspaceRoot: string): Promise<void> {
  const stoppedContexts: StageRunContext[] = [];
  const failStageA: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      stoppedContexts.push(context);
      return {
        stageId: context.stageId,
        status: "failed",
        success: false,
        summary: "Stage A failed.",
        artifacts: {
          generatedSpec: "generated-spec.md",
        },
      };
    },
  };
  const failStageB: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      stoppedContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Stage B should not run.",
        artifacts: {},
      };
    },
  };
  const failTraceRecorder = new InMemoryTraceRecorder();
  const failPipeline = new PipelineService({
    registry: createRegistry(
      {
        stageId: "fail-a",
        launchRequirements: ["sourceDoc"],
        runner: failStageA,
        nextStageId: "fail-b",
      },
      {
        stageId: "fail-b",
        launchRequirements: ["generatedSpec"],
        runner: failStageB,
        nextStageId: null,
      },
    ),
    traceRecorder: failTraceRecorder,
  });
  const failedTaskId = await failPipeline.launchTask({
    startStageId: "fail-a",
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(stoppedContexts.length, 1);
  assert.deepEqual(failTraceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "task_started",
    "stage_failed",
    "task_finished",
  ]);
  assert.equal(failPipeline.getTaskStatus(failedTaskId), "failed");
}

async function testStageDefinitionContinuationOverridesDefaultFlow(workspaceRoot: string): Promise<void> {
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
          stageAArtifact: "a.md",
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
  const stageC: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Stage C completed.",
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
        continuation: {
          async continue(context) {
            return {
              nextInputArtifacts: {
                ...context.mergeInputArtifacts(context.inputArtifacts, context.stageOutput),
                continuationArtifact: "continued.md",
              },
              nextStageId: "stage-c",
            };
          },
        },
      },
      {
        stageId: "stage-b",
        launchRequirements: ["stageAArtifact"],
        runner: stageB,
        nextStageId: null,
      },
      {
        stageId: "stage-c",
        launchRequirements: ["continuationArtifact"],
        runner: stageC,
        nextStageId: null,
      },
    ),
  });

  await pipeline.launchTask({
    startStageId: "stage-a",
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(invocationContexts.length, 2);
  assert.equal(invocationContexts[1]?.stageId, "stage-c");
  assert.deepEqual(invocationContexts[1]?.inputArtifacts, {
    sourceDoc: "source.md",
    stageAArtifact: "a.md",
    continuationArtifact: "continued.md",
  });
}

async function testSingleStepStopsAfterCurrentStage(workspaceRoot: string): Promise<void> {
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
    stopAfterCurrentStage: true,
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(invocationContexts.length, 1);
  assert.equal(pipeline.getTaskStatus(taskId), "completed");
  assert.deepEqual(pipeline.getTaskRecord(taskId)?.inputArtifacts, {
    sourceDoc: "source.md",
  });
  assert.equal(pipeline.getTaskRecord(taskId)?.currentStageId, "stage-a");
  assert.deepEqual(pipeline.getLastOutput(taskId)?.artifacts, {
    generatedSpec: "generated-spec.md",
  });
}

async function testInvalidNextStageValidation(workspaceRoot: string): Promise<void> {
  const implementationStage = createCompletedStage("Implementation stage executed.");
  const invalidRegistry = new StageRegistry();
  invalidRegistry.register({
    stageId: "stage-a",
    launchRequirements: [],
    runner: implementationStage,
    nextStageId: "missing-stage",
  });
  assert.throws(() => invalidRegistry.validate(), /references missing nextStageId "missing-stage"/);

  const invalidPipeline = new PipelineService({ registry: invalidRegistry });
  await assert.rejects(
    invalidPipeline.launchTask({
      startStageId: "stage-a",
      workspaceRoot,
      inputArtifacts: {},
    }),
    /references missing nextStageId "missing-stage"/,
  );
}

function createCompletedStage(summary: string): IStageRunner {
  return {
    async run(context: StageRunContext): Promise<StageOutput> {
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary,
        artifacts: {
          changedFiles: [],
        },
      };
    },
  };
}
