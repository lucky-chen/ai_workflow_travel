import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUnitLlmTrace,
  createItemDescriptor,
  createWorkspaceCopy,
  getPrimaryItemDesignDocumentPath,
  loadTraceRecords,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-document-generation-real-llm-task";
const runIds = {
  requirementGenerate: "5201-requirement-generate",
  architectureGenerate: "5202-architecture-generate",
  itemGenerate: "5203-item-generate",
  workPlanGenerate: "5204-work-plan-generate",
};

export async function runHelloServiceDocumentGenerationRealLlmTest() {
  const workspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(workspaceRoot);

    await runCli(
      workspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId: runIds.requirementGenerate, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(workspaceRoot, runIds.requirementGenerate),
      { executionUnitId: "requirement_design_generate", runtimeMode: "real" },
    );

    await runCli(workspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: realLlmTaskId,
      runId: runIds.architectureGenerate,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(workspaceRoot, runIds.architectureGenerate),
      { executionUnitId: "architecture_design_generate", runtimeMode: "real" },
    );

    const itemDescriptorPath = await createItemDescriptor(workspaceRoot);
    await runCli(
      workspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: realLlmTaskId, runId: runIds.itemGenerate, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(workspaceRoot, runIds.itemGenerate),
      { executionUnitId: "item_design_generate", runtimeMode: "real" },
    );

    await runCli(workspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: realLlmTaskId,
      runId: runIds.workPlanGenerate,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(workspaceRoot, runIds.workPlanGenerate),
      { executionUnitId: "work_plan_generate", runtimeMode: "real" },
    );

    const requirementDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8");
    const architectureDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8");
    const itemDesignDocument = await readFile(
      path.join(workspaceRoot, await getPrimaryItemDesignDocumentPath(workspaceRoot)),
      "utf8",
    );
    const workPlanDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "work_plan.yaml"), "utf8");

    assert.match(requirementDocument, /^# 1\. Background/m);
    assert.match(architectureDocument, /^# Technical Architecture/m);
    assert.match(itemDesignDocument, /^# /m);
    assert.match(workPlanDocument, /^plan_name:/m);
    assert.match(workPlanDocument, /^milestones:/m);
  } finally {
    await removeWorkspace(workspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceDocumentGenerationRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
