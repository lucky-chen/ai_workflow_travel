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

const successTaskId = "hello-service-overall-design-contract-success-task";
const runIds = {
  requirementGenerate: "4201-requirement-generate",
  architectureGenerate: "4202-architecture-generate",
  itemGenerate: "4203-item-generate",
  overallDesignContract: "4204-overall-design-contract",
};

export async function runHelloServiceOverallDesignContractSuccessTest() {
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
    await runCli(targetWorkspaceRoot, ["run", "unit", "overall_design_contract"], {
      taskId: successTaskId,
      runId: runIds.overallDesignContract,
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.overallDesignContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.overallDesignContract, "overall_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "overall_design_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "overall_design_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceOverallDesignContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
