import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  createItemDescriptor,
  createPreparedStepContext,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-work-execute-contract-failure-task";
const runIds = {
  requirementGenerate: "3801-requirement-generate",
  architectureGenerate: "3802-architecture-generate",
  itemGenerate: "3803-item-generate",
  workPlanGenerate: "3804-work-plan-generate",
  workExecute: "3805-work-execute",
};

export async function runHelloServiceWorkExecuteContractFailureTest() {
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
    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: failureTaskId, runId: runIds.workExecute },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute_contract", "--test-command", "node -e \"process.exit(1)\""],
      { taskId: failureTaskId, runId: runIds.workExecute },
    );

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.workExecute);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workExecute, "work_execute_contract_result.json"),
    );

    assert.equal(contractResult.passed, false);
    assert.equal(
      contractResult.issues.some((issue) => issue.checkItem === "work_execute_contract"),
      true,
    );
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "work_execute_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "work_execute_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceWorkExecuteContractFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
