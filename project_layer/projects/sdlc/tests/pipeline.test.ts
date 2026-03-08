import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { ArchitectureStageRunner } from "../src/workflow/stage-runners/architecture-stage-runner.js";
import { RequirementStageRunner } from "../src/workflow/stage-runners/requirement-stage-runner.js";
import { InMemoryTraceRecorder } from "../src/quality-gate/trace/trace-recorder.js";
import { PipelineService } from "../src/workflow/pipeline/pipeline.js";
import { StageRegistry } from "../src/workflow/pipeline/stage-registry.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../src/sdk/llm-executor/llm-executor.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";

export async function runPipelineTests(): Promise<void> {
  const workspaceRoot = await createTempDir("pipeline-workspace-");

  try {
    await testSingleStageLaunch(workspaceRoot);
    await testMissingStageLaunch(workspaceRoot);
    await testMissingRequiredArtifact(workspaceRoot);
    await testDuplicateStageRegistration();
    await testStageContinuationAndMerge(workspaceRoot);
    await testFailureStopsContinuation(workspaceRoot);
    await testInvalidNextStageValidation(workspaceRoot);
    await testStageEntryRetrySemantics(workspaceRoot);
    await testStageEntryFromSpecifiedStage(workspaceRoot);
    await testRequirementStageHandoffIntoArchitectureStage(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
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

  const pipeline = new PipelineService({
    registry,
    traceRecorder,
  });

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
  assert.deepEqual(receivedContext, {
    taskId,
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
    workspaceRoot,
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
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
  });

  assert.equal(continuedContexts.length, 2);
  assert.deepEqual(continuedContexts[0], {
    taskId: continuedTaskId,
    stageId: "stage-a",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      sourceDoc: "source.md",
    },
    params: undefined,
  });
  assert.deepEqual(continuedContexts[1], {
    taskId: continuedTaskId,
    stageId: "stage-b",
    attempt: 1,
    workspaceRoot,
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
    workspaceRoot,
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

async function testInvalidNextStageValidation(workspaceRoot: string): Promise<void> {
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
      workspaceRoot,
      inputArtifacts: {},
    }),
    /references missing nextStageId "missing-stage"/,
  );
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

async function testRequirementStageHandoffIntoArchitectureStage(workspaceRoot: string): Promise<void> {
  const storageRoot = await createTempDir("pipeline-requirement-");
  const artifactStore = new ArtifactStoreService(storageRoot);
  const traceRecorder = new InMemoryTraceRecorder();
  const invocationContexts: StageRunContext[] = [];
  const moduleDesignStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Module design stage completed.",
        artifacts: {},
      };
    },
  };

  try {
    const pipeline = new PipelineService({
      traceRecorder,
      registry: createRegistry(
        {
          stageId: "requirement_interpretation",
          launchRequirements: ["requirement_document"],
          runner: new RequirementStageRunner({ artifactStore, traceRecorder }),
          nextStageId: "architecture_design",
        },
        {
          stageId: "architecture_design",
          launchRequirements: ["requirement_document"],
          runner: new ArchitectureStageRunner({
            llmExecutor: new MockTextLlmExecutor(createArchitectureDocument()),
            artifactStore,
            traceRecorder,
          }),
          nextStageId: "module_design",
        },
        {
          stageId: "module_design",
          launchRequirements: ["architecture_document"],
          runner: moduleDesignStage,
          nextStageId: null,
        },
      ),
    });

    const taskId = await pipeline.launchTask({
      startStageId: "requirement_interpretation",
      workspaceRoot,
      inputArtifacts: {
        requirement_document: createRequirementDocument(),
      },
    });

    assert.equal(invocationContexts.length, 1);
    assert.deepEqual(invocationContexts[0], {
      taskId,
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: "docs/requirements/Requirement.md",
        architecture_document: "docs/architecture/TechnicalArchitecture.md",
      },
      params: undefined,
    });
    assert.equal(
      await artifactStore.getArtifact({
        taskId,
        stageId: "architecture_design",
        filePath: "docs/architecture/TechnicalArchitecture.md",
      }),
      createArchitectureDocument(),
    );
    assert.deepEqual(
      traceRecorder.getEvents().map((entry) => entry.event.eventType),
      [
        "task_started",
        "stage_started",
        "contract_checked",
        "gate_reviewed",
        "artifact_persisted",
        "stage_started",
        "generation_started",
        "generation_finished",
        "contract_checked",
        "gate_reviewed",
        "artifact_persisted",
        "task_finished",
      ],
    );
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

class MockTextLlmExecutor implements ILlmExecutor {
  constructor(private readonly content: string) {}

  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: this.content,
      responseFormat: "text",
    };
  }
}

function createArchitectureDocument(): string {
  return [
    "# 1. Purpose",
    "Define the overall technical architecture of the AI SDLC platform.",
    "- Team members: provide a shared high-level baseline for the team.",
    "- Senior engineers: review architecture direction and boundaries.",
    "- Junior engineers: understand system and module structure for later design and implementation.",
    "",
    "# 2. Scope",
    "This document defines the overall architecture boundary of the platform.",
    "It does not define module internals or implementation details.",
    "## 2.1 In Scope",
    "- Overall workflow from requirement input to design generation, implementation generation, review, validation, and acceptance.",
    "- Major modules and their responsibilities at architecture level.",
    "- Collaboration boundaries and dependency direction between major parts of the system.",
    "## 2.2 Out of Scope",
    "- Detailed module internals and implementation logic.",
    "- Detailed API contracts, prompt content, and parameter definitions inside each module.",
    "- Database schema details and storage-level design.",
    "",
    "# 3. Design Drivers",
    "## 3.1 end-to-end workflow support",
    "The architecture must support the full flow from requirement input to design generation, implementation generation, review, validation, and acceptance.",
    "## 3.2 requirement interpretation as stable upstream input",
    "Requirement documents written in natural language must be checked and stabilized before they are used as downstream input.",
    "## 3.3 design doc interpretation as stable upstream input",
    "Design outputs generated in upstream stages must be checked and stabilized before they are used as downstream input.",
    "## 3.4 human-in-the-loop control",
    "Important changes must remain human-reviewable and require users to confirm.",
    "## 3.5 Validation visibility",
    "The system must provide validation or test feedback for generated outputs.",
    "## 3.6 evolution from CLI to UI",
    "The platform is CLI-only in the current scope and future evolution should preserve workflow separation.",
    "## 3.7 execution transparency and stage traceability",
    "Users need stage status and important changes to remain visible and traceable.",
    "## 3.8 incremental update on requirement changes",
    "Requirement changes are frequent, so the architecture should support downstream updates.",
    "## 3.9 Stage-level launch flexibility",
    "The architecture should support launching from a selected stage when required inputs are available.",
    "",
    "# 4. Architecture Design",
    "## 4.1 Architecture Style",
    "The system adopts a layered modular monolith architecture.",
    "## 4.2 Layers or Partitions",
    "- Interface Layer: handles CLI entry and user confirmation.",
    "- Workflow: orchestrates stage execution and handoff.",
    "- Execution: generates stage artifacts.",
    "- Contract: checks generated artifacts against stage contracts.",
    "- Quality Gate: manages review, trace, and gate decisions.",
    "- Data: stores artifacts, history, and runtime state.",
    "## 4.3 Allowed Dependencies",
    "ALLOW:",
    "- Interface Layer -> Workflow",
    "- Workflow -> Execution",
    "- Workflow -> Contract",
    "- Workflow -> Quality Gate",
    "- Workflow -> Data",
    "- Execution -> Data",
    "- Contract -> Data",
    "- Quality Gate -> Data",
    "## 4.4 High-level Diagram",
    "```text",
    "[Interface Layer] -> [Workflow] -> [Execution]",
    "                         |            |",
    "                         v            v",
    "                    [Contract]   [Quality Gate]",
    "                         \\            /",
    "                          v          v",
    "                            [Data]",
    "```",
    "## 4.5 Runtime Topology",
    "- CLI Process: hosts interface, workflow, execution, contract, and quality-gate modules in one runtime.",
    "- Shared Storage: persists artifacts, history, and trace records.",
    "",
    "# 5. System Flow",
    "## 5.1 Main Flow",
    "```text",
    "[User] -> [Workflow] -> [Execution] -> [Contract] -> [Quality Gate] -> [Data]",
    "```",
    "1. User starts or resumes a stage.",
    "2. Workflow loads required upstream artifacts and invokes execution.",
    "3. Contract checks generated output and quality gate decides review outcome.",
    "The flow keeps generation, checking, review, and persistence explicit.",
    "## 5.2 Core Modules",
    "- Interface Layer: handles CLI entry and user confirmation.",
    "- Workflow: orchestrates stage execution.",
    "- Execution: generates stage artifacts.",
    "- Contract: validates generated artifacts.",
    "- Quality Gate: manages review and trace.",
    "- Data: persists artifacts and history.",
    "## 5.3 Interaction Model",
    "Modules collaborate through stage-oriented inputs, outputs, checks, and review decisions.",
    "### 5.3.1 Start Task",
    "Workflow creates runtime context and resolves stage entry.",
    "### 5.3.2 Generate Or Update Stage Artifact",
    "Execution produces or updates the stage artifact from upstream inputs.",
    "### 5.3.3 Check Stage Result",
    "Contract validates structure and stage boundaries.",
    "### 5.3.4 Review And Decision",
    "Quality Gate evaluates the change summary and returns a decision.",
    "### 5.3.5 Store Artifact And History",
    "Data modules persist accepted artifacts and task history.",
    "## 5.4 Key Considerations",
    "- keep stage boundaries explicit",
    "- keep downstream input stable after contract checks",
    "",
    "# 6. Non-Functional Considerations",
    "## 6.1 High Availability",
    "Current scope does not require distributed availability; correctness and reviewability are higher priority.",
    "## 6.2 High Scalability",
    "The architecture should keep module boundaries clear so background execution can evolve later.",
    "## 6.3 High Performance",
    "The architecture should preserve bounded stage work and visible progress instead of hiding long-running work.",
    "",
    "# 7. Design Documents",
    "## 7.1 Design Document Categories",
    "- Requirement document: stable product intent for downstream stages.",
    "- Architecture document: overall system structure and boundaries.",
    "- Module design document: module responsibilities and interfaces.",
    "- Implementation document: code-generation workplan and implementation result.",
    "## 7.2 Design Document Breakdown",
    "The workflow documents each recurring stage shape explicitly.",
    "### 7.2.1 Start Task",
    "Capture task entry, resume point, and required inputs.",
    "### 7.2.2 Generate Or Update Stage Artifact",
    "Describe how generation updates the stage artifact.",
    "### 7.2.3 Check Stage Result",
    "Describe contract checks and stabilization rules.",
    "### 7.2.4 Review And Decision",
    "Describe review inputs, gate semantics, and acceptance points.",
    "### 7.2.5 Store Artifact And History",
    "Describe persistence of accepted artifacts and task history.",
    "",
    "# 8. Open Issues",
    "- How validation workspaces should be isolated for implementation stages.",
    "- How UI evolution should expose the same stage trace semantics as the CLI.",
  ].join("\n");
}
