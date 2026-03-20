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
const runId = "3805-work-execute-contract-failure";

export async function runHelloServiceWorkExecuteContractFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: failureTaskId, runId },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: failureTaskId,
      runId,
    });
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: failureTaskId, runId },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: failureTaskId,
      runId,
    });
    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: failureTaskId, runId },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute_contract", "--test-command", "node -e \"process.exit(1)\""],
      { taskId: failureTaskId, runId },
    );

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runId);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "work_execute_contract_result.json"),
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
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "work_execute_contract"
          && entry.payload?.eventType === "llm_execution_started",
      ),
      false,
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
