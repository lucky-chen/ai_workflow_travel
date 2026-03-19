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

const successTaskId = "hello-service-work-execute-contract-success-task";
const runIds = {
  requirementGenerate: "4301-requirement-generate",
  architectureGenerate: "4302-architecture-generate",
  itemGenerate: "4303-item-generate",
  workPlanGenerate: "4304-work-plan-generate",
  workExecute: "4305-work-execute",
};

export async function runHelloServiceWorkExecuteContractSuccessTest() {
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
    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: successTaskId, runId: runIds.workExecute },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute_contract", "--test-command", "node -e \"process.exit(0)\""],
      { taskId: successTaskId, runId: runIds.workExecute },
    );

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.workExecute);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workExecute, "work_execute_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
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
  runHelloServiceWorkExecuteContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
