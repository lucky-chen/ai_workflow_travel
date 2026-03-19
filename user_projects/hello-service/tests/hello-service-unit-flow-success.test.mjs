import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertUnitLlmTrace,
  createItemDescriptor,
  createPreparedStepContext,
  createWorkspaceCopy,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
  writeArchitectureContractSuccessFixture,
  writeItemDesignContractSuccessFixture,
  writeRequirementContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const baselineTaskId = "hello-service-task";
const runIds = {
  requirementGenerate: "1001-requirement-generate",
  requirementContract: "1002-requirement-contract",
  architectureGenerate: "1003-architecture-generate",
  architectureContract: "1004-architecture-contract",
  itemGenerate: "1005-item-generate",
  itemContract: "1006-item-contract",
  overallDesignContract: "1007-overall-design-contract",
  workPlanGenerate: "1008-work-plan-generate",
  workPlanContract: "1009-work-plan-contract",
  workExecute: "1010-work-execute",
  workExecuteContract: "1010-work-execute",
};

export async function runHelloServiceSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: baselineTaskId, runId: runIds.requirementGenerate },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.requirementGenerate),
      { executionUnitId: "requirement_design_generate", runtimeMode: "mock" },
    );
    assert.match(
      await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8"),
      /hello-service/i,
    );
    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: baselineTaskId,
      runId: runIds.requirementContract,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.requirementContract, "requirement_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: baselineTaskId,
      runId: runIds.architectureGenerate,
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.architectureGenerate),
      { executionUnitId: "architecture_design_generate", runtimeMode: "mock" },
    );
    assert.match(
      await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8"),
      /hello-service uses a minimal function export/i,
    );
    await writeArchitectureContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: baselineTaskId,
      runId: runIds.architectureContract,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.architectureContract, "architecture_design_contract_result.json"))).passed,
      true,
    );

    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: baselineTaskId, runId: runIds.itemGenerate },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.itemGenerate),
      { executionUnitId: "item_design_generate", runtimeMode: "mock" },
    );
    assert.match(
      await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "utf8"),
      /Workflow coordinates the hello-service generation baseline/i,
    );
    await writeItemDesignContractSuccessFixture(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", "sdlc/docs/item_design/Workflow.md"],
      { taskId: baselineTaskId, runId: runIds.itemContract },
    );
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.itemContract, "item_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "overall_design_contract"], {
      taskId: baselineTaskId,
      runId: runIds.overallDesignContract,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.overallDesignContract, "overall_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: baselineTaskId,
      runId: runIds.workPlanGenerate,
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.workPlanGenerate),
      { executionUnitId: "work_plan_generate", runtimeMode: "mock" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: baselineTaskId,
      runId: runIds.workPlanContract,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workPlanContract, "work_plan_contract_result.json"))).passed,
      true,
    );

    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: baselineTaskId, runId: runIds.workExecute },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.workExecute),
      { executionUnitId: "work_execute", runtimeMode: "mock" },
    );

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute_contract", "--test-command", "node -e \"process.exit(0)\""],
      {
      taskId: baselineTaskId,
      runId: runIds.workExecuteContract,
      },
    );
    const workExecuteContractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workExecuteContract, "work_execute_contract_result.json"),
    );
    const workExecuteResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workExecute, "work_execute.json"),
    );
    assert.equal(workExecuteContractResult.passed, true);
    assert.equal(String(workExecuteContractResult.summary).includes("Test command passed"), true);

    const workPlanDocument = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "work_plan.yaml"), "utf8");

    assert.match(workPlanDocument, /deliver the hello-service implementation baseline/i);
    assert.equal(
      workExecuteResult.changedFiles.some(
        (changedFile) =>
          changedFile.path === "src/index.ts"
          && changedFile.operation === "create"
          && String(changedFile.content).includes("hello-service"),
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}
