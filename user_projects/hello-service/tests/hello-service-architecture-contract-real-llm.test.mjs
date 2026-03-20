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
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-architecture-contract-real-llm-task";
const runId = "5900-architecture-contract-real-llm";

export async function runHelloServiceArchitectureContractRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });

    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "architecture_design_contract", runtimeMode: "real" },
    );

    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "architecture_design_contract_result.json"),
    );
    assert.equal(contractResult.passed, true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceArchitectureContractRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
