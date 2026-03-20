import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUnitLlmTrace,
  createWorkspaceCopy,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
  writeRequirementContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-requirement-contract-real-llm-task";
const runId = "5800-requirement-contract-real-llm";

export async function runHelloServiceRequirementContractRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);
    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);

    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });

    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "requirement_design_contract", runtimeMode: "real" },
    );

    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "requirement_design_contract_result.json"),
    );
    assert.equal(contractResult.passed, true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceRequirementContractRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
