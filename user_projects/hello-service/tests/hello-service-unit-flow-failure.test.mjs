import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createItemDescriptor,
  createPreparedStepContext,
  createWorkspaceCopy,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
  writeArchitectureContractSuccessFixture,
  writeItemDesignContractSuccessFixture,
  writeRequirementContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-unit-flow-failure-task";
const runIds = {
  requirementGenerate: "1301-requirement-generate",
  requirementContract: "1302-requirement-contract",
  architectureGenerate: "1303-architecture-generate",
  architectureContract: "1304-architecture-contract",
  itemGenerate: "1305-item-generate",
  itemContract: "1306-item-contract",
  overallDesignContract: "1307-overall-design-contract",
  workPlanGenerate: "1308-work-plan-generate",
  workPlanContract: "1309-work-plan-contract",
  workExecute: "1310-work-execute",
  workExecuteContract: "1310-work-execute",
};

export async function runHelloServiceUnitFlowFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: failureTaskId, runId: runIds.requirementGenerate },
    );
    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);
    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: failureTaskId,
      runId: runIds.requirementContract,
    });

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: failureTaskId,
      runId: runIds.architectureGenerate,
    });
    await writeArchitectureContractSuccessFixture(targetWorkspaceRoot);
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: failureTaskId,
      runId: runIds.architectureContract,
    });

    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: failureTaskId, runId: runIds.itemGenerate },
    );
    await writeItemDesignContractSuccessFixture(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", "sdlc/docs/item_design/Workflow.md"],
      { taskId: failureTaskId, runId: runIds.itemContract },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "overall_design_contract"], {
      taskId: failureTaskId,
      runId: runIds.overallDesignContract,
    });
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: failureTaskId,
      runId: runIds.workPlanGenerate,
    });
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: failureTaskId,
      runId: runIds.workPlanContract,
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
      { taskId: failureTaskId, runId: runIds.workExecuteContract },
    );

    const workExecuteContractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workExecuteContract, "work_execute_contract_result.json"),
    );

    assert.equal(workExecuteContractResult.passed, false);
    assert.equal(String(workExecuteContractResult.summary).includes("Test command failed"), true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceUnitFlowFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
