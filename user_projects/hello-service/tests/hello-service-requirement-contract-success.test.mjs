import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
  writeRequirementContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const successTaskId = "hello-service-requirement-contract-success-task";
const runIds = {
  requirementGenerate: "4001-requirement-generate",
  requirementContract: "4002-requirement-contract",
};

export async function runHelloServiceRequirementContractSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);
    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: successTaskId,
      runId: runIds.requirementContract,
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.requirementContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.requirementContract, "requirement_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "requirement_design_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "requirement_design_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceRequirementContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
