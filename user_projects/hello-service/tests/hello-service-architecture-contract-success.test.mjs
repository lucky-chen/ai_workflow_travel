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
} from "./hello-service-test-helpers.mjs";

const successTaskId = "hello-service-architecture-contract-success-task";
const runIds = {
  requirementGenerate: "4101-requirement-generate",
  architectureGenerate: "4102-architecture-generate",
  architectureContract: "4103-architecture-contract",
};

export async function runHelloServiceArchitectureContractSuccessTest() {
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
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: successTaskId,
      runId: runIds.architectureContract,
      extraEnv: {
        SDLC_TEST_CONTRACT_SUCCESS_STAGES: "architecture_design_contract",
      },
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.architectureContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.architectureContract, "architecture_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "architecture_design_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "architecture_design_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceArchitectureContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
