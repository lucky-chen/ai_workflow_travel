import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { RequirementStageRunner } from "../src/workflow/stage-runners/requirement-stage-runner.js";
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
  await testStageEntryRetrySemantics();
  await testStageEntryFromSpecifiedStage();
  await testRequirementStageHandoffIntoArchitectureStage();
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
    attempt: 1,
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
  assert.equal(pipeline.getTaskStatus(taskId), "completed");
  assert.deepEqual(pipeline.getTaskRecord(taskId), {
    taskId,
    startStageId: "implementation",
    currentStageId: "implementation",
    attempt: 1,
    status: "completed",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
    lastOutput: {
      stageId: "implementation",
      status: "completed",
      success: true,
      summary: "Implementation stage executed.",
      artifacts: {
        changedFiles: [],
      },
    },
  });
}

async function testMissingStageLaunch(): Promise<void> {
  const emptyRegistry = new StageRegistry();
  const emptyPipeline = new PipelineService({ registry: emptyRegistry });
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
    attempt: 1,
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      sourceDoc: "source.md",
    },
    params: undefined,
  });
  assert.deepEqual(continuedContexts[1], {
    taskId: continuedTaskId,
    stageId: "stage-b",
    attempt: 1,
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
  assert.equal(continuationPipeline.getTaskStatus(continuedTaskId), "completed");
  assert.equal(continuationPipeline.getTaskRecord(continuedTaskId)?.currentStageId, "stage-b");
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
  assert.equal(failPipeline.getTaskStatus(failedTaskId), "failed");
  assert.equal(failPipeline.getTaskRecord(failedTaskId)?.currentStageId, "fail-a");
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

  const invalidPipeline = new PipelineService({ registry: invalidRegistry });
  await assert.rejects(
    invalidPipeline.launchTask({
      startStageId: "stage-a",
      workspaceRoot: "/workspace/demo",
      inputArtifacts: {},
    }),
    /references missing nextStageId "missing-stage"/,
  );
}

async function testStageEntryRetrySemantics(): Promise<void> {
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
    workspaceRoot: "/workspace/demo",
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
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
  });

  assert.equal(invocationContexts.length, 2);
  assert.equal(invocationContexts[0]?.attempt, 1);
  assert.equal(invocationContexts[1]?.attempt, 2);
  assert.equal(pipeline.getTaskStatus(taskId), "completed");
}

async function testStageEntryFromSpecifiedStage(): Promise<void> {
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
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  await pipeline.launchTask({
    taskId,
    triggerReason: "stage_entry",
    startStageId: "stage-b",
    workspaceRoot: "/workspace/demo",
    inputArtifacts: {
      generatedSpec: "generated-spec.md",
    },
  });

  assert.equal(invocationContexts.length, 3);
  assert.equal(invocationContexts[2]?.stageId, "stage-b");
  assert.equal(invocationContexts[2]?.attempt, 2);
}

async function testRequirementStageHandoffIntoArchitectureStage(): Promise<void> {
  const storageRoot = await createTempDir("pipeline-requirement-");
  const artifactStore = new ArtifactStoreService(storageRoot);
  const invocationContexts: StageRunContext[] = [];
  const architectureStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Architecture stage completed.",
        artifacts: {},
      };
    },
  };

  try {
    const pipeline = new PipelineService({
      registry: createRegistry(
        {
          stageId: "requirement_interpretation",
          launchRequirements: ["requirement_document"],
          runner: new RequirementStageRunner({ artifactStore }),
          nextStageId: "architecture_design",
        },
        {
          stageId: "architecture_design",
          launchRequirements: ["requirement_document"],
          runner: architectureStage,
          nextStageId: null,
        },
      ),
    });

    const taskId = await pipeline.launchTask({
      startStageId: "requirement_interpretation",
      workspaceRoot: "/workspace/demo",
      inputArtifacts: {
        requirement_document: createRequirementDocument(),
      },
    });

    assert.equal(invocationContexts.length, 1);
    assert.deepEqual(invocationContexts[0], {
      taskId,
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot: "/workspace/demo",
      inputArtifacts: {
        requirement_document: "docs/requirements/Requirement.md",
      },
      params: undefined,
    });
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
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

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

function createRequirementDocument(): string {
  return [
    "# 1. Background",
    "- Users lose time coordinating requirement changes.",
    "- Product teams need a stable requirement baseline.",
    "- The platform should improve alignment before implementation.",
    "",
    "# 2. User Scenarios",
    "## 2.1 Product Managers",
    "Need to turn rough product requests into stable requirement documents.",
    "## 2.2 Engineers",
    "Need requirement documents that are explicit enough for downstream design.",
    "## 2.3 Delivery Team",
    "Need shared understanding before architecture and module design begin.",
    "",
    "# 3. Product Goals",
    "Deliver a stable requirement baseline for downstream stages.",
    "- Reduce ambiguity before architecture design starts.",
    "- Keep the document focused on product intent.",
    "- Make downstream handoff predictable.",
    "",
    "# 4. Core Problems and Product Abilities",
    "## 4.1 Requirement ambiguity",
    "- problem: teams interpret rough requests differently.",
    "- ability: the product structures requirement content into a stable template.",
    "",
    "# 5. User Workflow",
    "## 5.1 Standard Flow",
    "### 5.1.1 Draft input",
    "User provides initial requirement context.",
    "### 5.1.2 Requirement normalization",
    "System organizes the requirement into the standard document.",
    "## 5.2 Resume Support Entry Points",
    "- confirmed requirement draft",
    "  resume when the requirement is already reviewed.",
    "## 5.3 Failure Handling",
    "- request clarification when key requirement context is missing.",
    "",
    "# 6. Inputs and Outputs",
    "## 6.1 Inputs",
    "- raw requirement input",
    "## 6.2 Prerequisites",
    "- confirmed product context",
    "## 6.3 Outputs",
    "- requirement document for downstream stages",
    "",
    "# 7 Scope and Non-Goals",
    "## 7.1 V1: MVP",
    "- normalize requirement content and support review.",
    "## 7.2 V2: Available",
    "- compare revisions and support incremental updates.",
    "## 7.3 V3: General",
    "- broaden support for more product workflows.",
    "",
    "# 8. Success Criteria",
    "## 8.1 V1",
    "- requirement document passes contract review.",
    "## 8.2 V2",
    "- downstream architecture generation needs fewer manual fixes.",
    "## 8.3 V3",
    "- teams adopt the workflow consistently.",
    "",
    "# 9. Risks",
    "- users may provide underspecified requests.",
    "",
    "# 10. Constraints",
    "## 10.1 Timeline",
    "- review points must remain explicit.",
  ].join("\n");
}
