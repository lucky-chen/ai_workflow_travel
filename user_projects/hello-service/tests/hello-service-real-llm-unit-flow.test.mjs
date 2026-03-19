import path from "node:path";
import {
  assertUnitLlmTrace,
  createItemDescriptor,
  createWorkspaceCopy,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-real-llm-task";
const runIds = {
  requirementGenerate: "3001-requirement-generate",
  requirementContract: "3002-requirement-contract",
  architectureGenerate: "3003-architecture-generate",
  architectureContract: "3004-architecture-contract",
  itemGenerate: "3005-item-generate",
  itemContract: "3006-item-contract",
  workPlanGenerate: "3007-work-plan-generate",
  workPlanContract: "3008-work-plan-contract",
};

export async function runHelloServiceRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId: runIds.requirementGenerate, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.requirementGenerate),
      { executionUnitId: "requirement_design_generate", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: realLlmTaskId,
      runId: runIds.requirementContract,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.requirementContract),
      { executionUnitId: "requirement_design_contract", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: realLlmTaskId,
      runId: runIds.architectureGenerate,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.architectureGenerate),
      { executionUnitId: "architecture_design_generate", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: realLlmTaskId,
      runId: runIds.architectureContract,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.architectureContract),
      { executionUnitId: "architecture_design_contract", runtimeMode: "real" },
    );

    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: realLlmTaskId, runId: runIds.itemGenerate, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.itemGenerate),
      { executionUnitId: "item_design_generate", runtimeMode: "real" },
    );

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", "sdlc/docs/item_design/Workflow.md"],
      { taskId: realLlmTaskId, runId: runIds.itemContract, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.itemContract),
      { executionUnitId: "item_design_contract", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: realLlmTaskId,
      runId: runIds.workPlanGenerate,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.workPlanGenerate),
      { executionUnitId: "work_plan_generate", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: realLlmTaskId,
      runId: runIds.workPlanContract,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.workPlanContract),
      { executionUnitId: "work_plan_contract", runtimeMode: "real" },
    );

    await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workPlanContract, "work_plan_contract_result.json"));
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}
