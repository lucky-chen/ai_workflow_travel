import assert from "node:assert/strict";

import { InMemoryTraceRecorder } from "../src/quality-gate/trace/trace-recorder.js";
import { PipelineService } from "../src/workflow/pipeline/pipeline.js";
import { StageRegistry } from "../src/workflow/pipeline/stage-registry.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";

export async function runPipelineTests(): Promise<void> {
  await testSingleStageLaunch();
  await testMissingStageLaunch();
  await testMissingRequiredArtifact();
  await testDuplicateStageRegistration();
  await testStageContinuationAndMerge();
  await testFailureStopsContinuation();
  await testInvalidNextStageValidation();
}

async function testSingleStageLaunch(): Promise<void> {
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

  const pipeline = new PipelineService({
    registry,
    traceRecorder,
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
    status: "completed",
    success: true,
    summary: "Implementation stage executed.",
    artifacts: {
      changedFiles: [],
    },
  });
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "task_started",
    "task_finished",
  ]);
}

async function testMissingStageLaunch(): Promise<void> {
  const emptyPipeline = new PipelineService({ registry: new StageRegistry() });
  await assert.rejects(
    emptyPipeline.launchTask({
      startStageId: "missing-stage",
      workspaceRoot: "/workspace/demo",
      inputArtifacts: {},
    }),
    /No stage definition registered/,
  );
}

async function testMissingRequiredArtifact(): Promise<void> {
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
      workspaceRoot: "/workspace/demo",
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

async function testStageContinuationAndMerge(): Promise<void> {
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
  const continuationRegistry = new StageRegistry();
  continuationRegistry.register({
    stageId: "stage-a",
    launchRequirements: ["sourceDoc"],
    runner: stageA,
    nextStageId: "stage-b",
  });
  continuationRegistry.register({
    stageId: "stage-b",
    launchRequirements: ["generatedSpec"],
    runner: stageB,
    nextStageId: null,
  });
  const continuationTraceRecorder = new InMemoryTraceRecorder();
  const continuationPipeline = new PipelineService({
    registry: continuationRegistry,
    traceRecorder: continuationTraceRecorder,
  });
  const continuedTaskId = await continuationPipeline.launchTask({
    startStageId: "stage-a",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(continuedContexts.length, 2);
  assert.deepEqual(continuedContexts[0], {
    taskId: continuedTaskId,
    stageId: "stage-a",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      sourceDoc: "source.md",
    },
    params: undefined,
  });
  assert.deepEqual(continuedContexts[1], {
    taskId: continuedTaskId,
    stageId: "stage-b",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      sourceDoc: "source.md",
      generatedSpec: "generated-spec.md",
    },
    params: undefined,
  });
  assert.deepEqual(continuationPipeline.getLastOutput(continuedTaskId), {
    stageId: "stage-b",
    status: "completed",
    success: true,
    summary: "Stage B completed.",
    artifacts: {},
  });
  assert.deepEqual(continuationTraceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "task_started",
    "task_finished",
  ]);
  continuationRegistry.validate();
}

async function testFailureStopsContinuation(): Promise<void> {
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
  const failRegistry = new StageRegistry();
  failRegistry.register({
    stageId: "fail-a",
    launchRequirements: ["sourceDoc"],
    runner: failStageA,
    nextStageId: "fail-b",
  });
  failRegistry.register({
    stageId: "fail-b",
    launchRequirements: ["generatedSpec"],
    runner: failStageB,
    nextStageId: null,
  });
  const failTraceRecorder = new InMemoryTraceRecorder();
  const failPipeline = new PipelineService({
    registry: failRegistry,
    traceRecorder: failTraceRecorder,
  });
  const failedTaskId = await failPipeline.launchTask({
    startStageId: "fail-a",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(stoppedContexts.length, 1);
  assert.deepEqual(failPipeline.getLastOutput(failedTaskId), {
    stageId: "fail-a",
    status: "failed",
    success: false,
    summary: "Stage A failed.",
    artifacts: {
      generatedSpec: "generated-spec.md",
    },
  });
  assert.deepEqual(failTraceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "task_started",
    "stage_failed",
    "task_finished",
  ]);
}

async function testInvalidNextStageValidation(): Promise<void> {
  const implementationStage = createCompletedStage("Implementation stage executed.");
  const invalidRegistry = new StageRegistry();
  invalidRegistry.register({
    stageId: "stage-a",
    launchRequirements: [],
    runner: implementationStage,
    nextStageId: "missing-stage",
  });
  assert.throws(
    () => invalidRegistry.validate(),
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

function createRegistry(...definitions: Array<{
  stageId: string;
  launchRequirements: string[];
  runner: IStageRunner;
  nextStageId: string | null;
}>): StageRegistry {
  const registry = new StageRegistry();
  for (const definition of definitions) {
    registry.register(definition);
  }

  return registry;
}
