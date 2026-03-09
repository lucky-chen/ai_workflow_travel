import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import { ImplementationPlanStageRunner } from "../../src/workflow/stage-runners/implementation-plan-stage-runner.js";

export async function runImplementationPlanStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("implementation-plan-stage-runner-");
  const workspaceRoot = await createTempDir("implementation-plan-workspace-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  try {
    await testImplementationPlanStageRunnerPersistsAcceptedDocument(artifactStore, workspaceRoot);
    await testImplementationPlanStageRunnerRejectStopsPersistence(artifactStore, workspaceRoot);
    await testImplementationPlanStageRunnerContractFailure(artifactStore, workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testImplementationPlanStageRunnerPersistsAcceptedDocument(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const changeGate = new InMemoryChangeGate();
  const content = createImplementationPlanDocument();
  const runner = new ImplementationPlanStageRunner({
    llmExecutor: new ImplementationPlanStageRunnerLlmExecutor(content),
    artifactStore,
    traceRecorder,
    changeGate,
  });

  const output = await runner.run({
    taskId: "task-1",
    stageId: "implementation_plan",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: createInputArtifacts(),
  });

  assert.equal(output.artifacts.implementation_workplan, "plans/implementation/ImplementationWorkPlan.md");
  assert.equal(typeof output.artifacts.parsed_implementation_workplan, "string");
  const parsedWorkplan = JSON.parse(output.artifacts.parsed_implementation_workplan) as {
    steps: Array<{ stepId: string; batches: Array<{ batchId: string }> }>;
  };
  assert.equal(parsedWorkplan.steps[0]?.stepId, "step-1");
  assert.equal(parsedWorkplan.steps[0]?.batches[0]?.batchId, "batch-1");
  assert.equal(output.artifacts.current_step, JSON.stringify({ stepId: "step-1", batchId: "batch-1" }));
  assert.equal(
    await artifactStore.getArtifact({
      taskId: "task-1",
      stageId: "implementation_plan",
      filePath: "plans/implementation/ImplementationWorkPlan.md",
    }),
    content,
  );
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "generation_started",
    "generation_finished",
    "contract_checked",
    "gate_reviewed",
    "artifact_persisted",
  ]);
}

async function testImplementationPlanStageRunnerRejectStopsPersistence(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ImplementationPlanStageRunner({
    llmExecutor: new ImplementationPlanStageRunnerLlmExecutor(createImplementationPlanDocument()),
    artifactStore,
    changeGate: new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Rejected in review.",
      },
    }),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-2",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: createInputArtifacts(),
    }),
    /Change review ended with action "reject"\./,
  );

  await assert.rejects(
    artifactStore.getArtifact({
      taskId: "task-2",
      stageId: "implementation_plan",
      filePath: "plans/implementation/ImplementationWorkPlan.md",
    }),
  );
}

async function testImplementationPlanStageRunnerContractFailure(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ImplementationPlanStageRunner({
    llmExecutor: new ImplementationPlanStageRunnerLlmExecutor("# Code Generation Execution Plan\nBroken"),
    artifactStore,
    changeGate: new InMemoryChangeGate(),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-3",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: createInputArtifacts(),
    }),
    /Implementation plan contract failed:/,
  );
}

function createInputArtifacts() {
  return {
    requirement_document: "docs/requirements/Requirement.md",
    architecture_document: "docs/architecture/TechnicalArchitecture.md",
    module_design_documents: JSON.stringify([
      "docs/module_design/Workflow.md",
      "docs/module_design/Data.md",
    ]),
  };
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class ImplementationPlanStageRunnerLlmExecutor implements ILlmExecutor {
  constructor(private readonly content: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      const passed = this.content.includes("## 1. Purpose")
        && this.content.includes("## 3. Execution Steps")
        && /### Step \d+\./.test(this.content)
        && this.content.includes("Architecture modules in scope")
        && this.content.includes("Batch 1:");
      return {
        content: JSON.stringify({
          passed,
          summary: passed
            ? "Implementation workplan passed contract checks."
            : "Implementation workplan failed contract checks.",
          issues: passed ? [] : [
            {
              checkItem: "execution_step_structure_consistency",
              message: "Missing required implementation-plan sections.",
              severity: "high",
            },
          ],
        }),
        responseFormat: "json",
      };
    }

    return {
      content: this.content,
      responseFormat: "text",
      metadata: {
        ...(request.metadata ?? {}),
      },
    };
  }
}

function createImplementationPlanDocument(): string {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Purpose",
    "Build project_layer from zero to a complete workflow.",
    "",
    "## 1.1 Collaboration Rule",
    "All implementation work under this plan must follow the shared collaboration standard:",
    "",
    "- `project_layer/docs/COLLABORATION_STANDARD.md`",
    "",
    "## 2. Workflow Delivery Order",
    "1. shared workflow backbone",
    "2. requirement_interpretation stage",
    "3. architecture_design stage",
    "4. module_design stage",
    "",
    "## 3. Execution Steps",
    "### Step 1. Deliver Shared Workflow Backbone",
    "- [x] Step 1 is partially completed",
    "- [x] Architecture modules in scope",
    "  - [x] `Workflow/Pipeline`",
    "- [x] Batch 1: interfaces and skeleton",
    "  - [x] shared contracts",
    "  - [x] stage registry",
  ].join("\n");
}
