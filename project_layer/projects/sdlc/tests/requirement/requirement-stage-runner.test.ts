import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import { RequirementStageRunner } from "../../src/workflow/stage-runners/requirement-stage-runner.js";

export async function runRequirementStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("requirement-stage-runner-");
  const workspaceRoot = await createTempDir("requirement-workspace-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  try {
    await testRequirementStageRunnerPersistsAcceptedDocument(artifactStore, workspaceRoot);
    await testRequirementStageRunnerRejectStopsPersistence(artifactStore, workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRequirementStageRunnerPersistsAcceptedDocument(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const changeGate = new InMemoryChangeGate();
  const runner = new RequirementStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    llmExecutor: new ApproveRequirementContractLlmExecutor(),
  });
  const content = createRequirementDocument();

  const output = await runner.run({
    taskId: "task-1",
    stageId: "requirement_interpretation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: content,
    },
  });

  assert.equal(output.artifacts.requirement_document, "docs/requirements/Requirement.md");
  assert.equal(
    await artifactStore.getArtifact({
      taskId: "task-1",
      stageId: "requirement_interpretation",
      filePath: "docs/requirements/Requirement.md",
    }),
    content,
  );
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "contract_checked",
    "gate_reviewed",
    "artifact_persisted",
  ]);
}

async function testRequirementStageRunnerRejectStopsPersistence(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new RequirementStageRunner({
    artifactStore,
    changeGate: new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Rejected in review.",
      },
    }),
    llmExecutor: new ApproveRequirementContractLlmExecutor(),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-2",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: createRequirementDocument(),
      },
    }),
    /Change review ended with action "reject"\./,
  );

  await assert.rejects(
    artifactStore.getArtifact({
      taskId: "task-2",
      stageId: "requirement_interpretation",
      filePath: "docs/requirements/Requirement.md",
    }),
  );
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

class ApproveRequirementContractLlmExecutor implements ILlmExecutor {
  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: JSON.stringify({
        passed: true,
        summary: "Requirement document passed contract checks.",
        issues: [],
      }),
      responseFormat: "json",
    };
  }
}
