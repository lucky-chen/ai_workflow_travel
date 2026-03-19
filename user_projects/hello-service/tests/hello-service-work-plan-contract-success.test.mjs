import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  createItemDescriptor,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const successTaskId = "hello-service-work-plan-contract-success-task";
const runIds = {
  requirementGenerate: "3701-requirement-generate",
  architectureGenerate: "3702-architecture-generate",
  itemGenerate: "3703-item-generate",
  workPlanGenerate: "3704-work-plan-generate",
  workPlanContract: "3705-work-plan-contract",
};

export async function runHelloServiceWorkPlanContractSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: successTaskId, runId: runIds.requirementGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: successTaskId,
      runId: runIds.architectureGenerate,
    });
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: successTaskId, runId: runIds.itemGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: successTaskId,
      runId: runIds.workPlanGenerate,
    });
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: successTaskId,
      runId: runIds.workPlanContract,
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.workPlanContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workPlanContract, "work_plan_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "work_plan_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "work_plan_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceWorkPlanContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
