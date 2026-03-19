import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
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

const failureTaskId = "hello-service-work-plan-contract-failure-task";
const runIds = {
  requirementGenerate: "4401-requirement-generate",
  architectureGenerate: "4402-architecture-generate",
  itemGenerate: "4403-item-generate",
  workPlanGenerate: "4404-work-plan-generate",
  workPlanContract: "4405-work-plan-contract",
};

export async function runHelloServiceWorkPlanContractFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: failureTaskId, runId: runIds.requirementGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: failureTaskId,
      runId: runIds.architectureGenerate,
    });
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: failureTaskId, runId: runIds.itemGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: failureTaskId,
      runId: runIds.workPlanGenerate,
    });

    await writeFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "work_plan.yaml"), "version: [", "utf8");

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: failureTaskId,
      runId: runIds.workPlanContract,
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.workPlanContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workPlanContract, "work_plan_contract_result.json"),
    );

    assert.equal(contractResult.passed, false);
    assert.equal(
      contractResult.issues.some((issue) => issue.checkItem === "yaml_work_plan_structure_complete"),
      true,
    );
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
  runHelloServiceWorkPlanContractFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
