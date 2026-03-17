import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { WorkPlanContract } from "../../../src/Capability/WorkPlan/work-plan-contract.js";
import { WorkPlanGenerator } from "../../../src/Capability/WorkPlan/work-plan-generator.js";
import { WorkPlanRuntimeUnit } from "../../../src/Capability/WorkPlan/work-plan-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runWorkPlanCapabilityTests(): Promise<void> {
  await testWorkPlanGeneratorReturnsGeneratedPlan();
  await testWorkPlanContractReportsMissingStructure();
  await testWorkPlanRuntimeUnitPersistsGeneratedPlan();
}

async function testWorkPlanGeneratorReturnsGeneratedPlan(): Promise<void> {
  const workspaceRoot = await createTempDir("work-plan-generator-");

  try {
    const generatedPlan = [
      "version: 1",
      "plan_name: hello_service_work_plan",
      "target: deliver the hello-service implementation baseline",
      "sources:",
      "  requirement_doc: sdlc/docs/Requirement.md",
      "  architecture_doc: sdlc/docs/TechnicalArchitecture.md",
      "  breakdown_docs_dir: sdlc/docs/item_design",
      "  active_work_plan: sdlc/docs/work_plan.yaml",
      "  code_root: .",
      "principles:",
      "  - keep implementation minimal",
      "execution_scope: deliver the hello-service baseline",
      "status: pending",
      "current_focus:",
      "  milestone_id: milestone_1_delivery",
      "  stage_id: stage_1_delivery",
      "  batch_id: batch_1_1_source_file",
      "  task_id: task_1_1_1",
      "milestones:",
      "  - milestone_id: milestone_1_delivery",
      "    name: baseline delivery",
      "    goal: deliver the hello-service baseline",
      "    status: pending",
      "    stages:",
      "      - stage_id: stage_1_delivery",
      "        name: source delivery",
      "        goal: add src/index.ts",
      "        status: pending",
      "        batches:",
      "          - batch_id: batch_1_1_source_file",
      "            name: create source file",
      "            goal: add src/index.ts",
      "            status: pending",
      "            tasks:",
      "              - task_id: task_1_1_1",
      "                summary: add src/index.ts with hello export",
      "                status: pending",
      "                involved_files:",
      "                  - src/index.ts",
    ].join("\n");
    const generator = new WorkPlanGenerator({
      llmExecutor: createMockLlmExecutor(async () => ({
        content: generatedPlan,
        responseFormat: "text",
      })),
    });

    const result = await generator.run(
      createExecutionContext(workspaceRoot, "work_plan_generate", {
        requirement_design: "# Requirement\n",
        architecture_design: "# Architecture\n",
        item_design_documents: JSON.stringify(["# Workflow Design\n"]),
      }),
    );

    assert.equal(result.executionUnitId, "work_plan");
    assert.equal(result.success, true);
    assert.equal(result.summary, "Work plan generated.");
    assert.deepEqual(result.artifacts, {
      artifactKey: "work_plan",
      content: generatedPlan,
    });
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testWorkPlanContractReportsMissingStructure(): Promise<void> {
  const workspaceRoot = await createTempDir("work-plan-contract-");

  try {
    const result = await new WorkPlanContract().check(
      createExecutionContext(workspaceRoot, "work_plan_contract", {
        requirement_design: "# Requirement\n",
        architecture_design: "# Architecture\n",
        item_design_documents: JSON.stringify(["# Workflow Design\n"]),
      }),
      {
        executionUnitId: "work_plan",
        success: true,
        summary: "Loaded work plan artifact for contract check.",
        artifacts: {
          artifactKey: "work_plan",
          content: "version: 1\nplan_name: broken_plan\n",
        },
      },
    );

    assert.equal(result.passed, false);
    assert.match(result.summary, /failed contract checks/i);
    assert.equal(
      result.issues.some((issue) => issue.message.includes("Missing required top-level key")),
      true,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testWorkPlanRuntimeUnitPersistsGeneratedPlan(): Promise<void> {
  const workspaceRoot = await createTempDir("work-plan-runtime-unit-");
  const storageRoot = await createTempDir("work-plan-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs", "item_design"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "# Requirement Input\n", "utf8");
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "# Architecture Input\n", "utf8");
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "# Workflow Design\n", "utf8");

    const generatedPlan = [
      "version: 1",
      "plan_name: hello_service_work_plan",
      "target: deliver the hello-service implementation baseline",
      "sources:",
      "  requirement_doc: sdlc/docs/Requirement.md",
      "  architecture_doc: sdlc/docs/TechnicalArchitecture.md",
      "  breakdown_docs_dir: sdlc/docs/item_design",
      "  active_work_plan: sdlc/docs/work_plan.yaml",
      "  code_root: .",
      "principles:",
      "  - keep implementation minimal",
      "execution_scope: deliver the hello-service baseline",
      "status: pending",
      "current_focus:",
      "  milestone_id: milestone_1_delivery",
      "  stage_id: stage_1_delivery",
      "  batch_id: batch_1_1_source_file",
      "  task_id: task_1_1_1",
      "milestones:",
      "  - milestone_id: milestone_1_delivery",
      "    name: baseline delivery",
      "    goal: deliver the hello-service baseline",
      "    status: pending",
      "    stages:",
      "      - stage_id: stage_1_delivery",
      "        name: source delivery",
      "        goal: add src/index.ts",
      "        status: pending",
      "        batches:",
      "          - batch_id: batch_1_1_source_file",
      "            name: create source file",
      "            goal: add src/index.ts",
      "            status: pending",
      "            tasks:",
      "              - task_id: task_1_1_1",
      "                summary: add src/index.ts with hello export",
      "                status: pending",
      "                involved_files:",
      "                  - src/index.ts",
    ].join("\n");
    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new WorkPlanRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => ({
        content: generatedPlan,
        responseFormat: "text",
      })),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "work_plan_generate",
      },
      {
        workspaceRoot,
        runId: "work-plan-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.match(result.summary, /Work plan generated/);
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "work_plan.yaml"), "utf8"),
      generatedPlan,
    );
    await assert.rejects(
      readFile(
        path.join(
          storageRoot,
          "work-plan-runtime-run",
          "sdlc",
          "docs",
          "work_plan.yaml",
        ),
        "utf8",
      ),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT",
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
