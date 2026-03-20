import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertUnitLlmTrace,
  createItemDescriptor,
  createPreparedStepContext,
  createWorkspaceCopy,
  getPrimaryItemDesignDocumentPath,
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
const runId = "1000-unit-flow-success";

export async function runHelloServiceSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: baselineTaskId, runId },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "requirement_design_generate", runtimeMode: "mock" },
    );
    assert.match(
      await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8"),
      /hello-service/i,
    );
    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: baselineTaskId,
      runId,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "requirement_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: baselineTaskId,
      runId,
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "architecture_design_generate", runtimeMode: "mock" },
    );
    assert.match(
      await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8"),
      /hello-service uses a minimal function export/i,
    );
    await writeArchitectureContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: baselineTaskId,
      runId,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "architecture_design_contract_result.json"))).passed,
      true,
    );

    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: baselineTaskId, runId },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "item_design_generate", runtimeMode: "mock" },
    );
    assert.match(
      await readFile(path.join(targetWorkspaceRoot, await getPrimaryItemDesignDocumentPath(targetWorkspaceRoot)), "utf8"),
      /coordinates the hello-service generation baseline/i,
    );
    await writeItemDesignContractSuccessFixture(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", await getPrimaryItemDesignDocumentPath(targetWorkspaceRoot)],
      { taskId: baselineTaskId, runId },
    );
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "item_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "overall_design_contract"], {
      taskId: baselineTaskId,
      runId,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "overall_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: baselineTaskId,
      runId,
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "work_plan_generate", runtimeMode: "mock" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: baselineTaskId,
      runId,
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "work_plan_contract_result.json"))).passed,
      true,
    );

    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: baselineTaskId, runId },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "work_execute", runtimeMode: "mock" },
    );

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute_contract", "--test-command", "node -e \"process.exit(0)\""],
      {
        taskId: baselineTaskId,
        runId,
      },
    );
    const workExecuteContractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "work_execute_contract_result.json"),
    );
    const workExecuteResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "work_execute.json"),
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
