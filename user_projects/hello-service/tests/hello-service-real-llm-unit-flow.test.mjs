import assert from "node:assert/strict";
import path from "node:path";
import {
  assertUnitLlmTrace,
  createItemDescriptor,
  createWorkspaceCopy,
  getPrimaryItemDesignDocumentPath,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
  writeArchitectureBreakdownFixture,
  writeArchitectureContractSuccessFixture,
  writeItemDesignContractSuccessFixture,
  writeRequirementContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-real-llm-task";
const runId = "3000-real-llm-unit-flow";

export async function runHelloServiceRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "requirement_design_generate", runtimeMode: "real" },
    );
    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "requirement_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "architecture_design_generate", runtimeMode: "real" },
    );
    await writeArchitectureContractSuccessFixture(targetWorkspaceRoot);
    await writeArchitectureBreakdownFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "architecture_design_contract_result.json"))).passed,
      true,
    );

    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "item_design_generate", runtimeMode: "real" },
    );
    await writeItemDesignContractSuccessFixture(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", await getPrimaryItemDesignDocumentPath(targetWorkspaceRoot)],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "item_design_contract_result.json"))).passed,
      true,
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "work_plan_generate", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_contract"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });
    assert.equal(
      (await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "work_plan_contract_result.json"))).passed,
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}
