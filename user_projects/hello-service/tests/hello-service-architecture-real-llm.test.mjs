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

const realLlmTaskId = "hello-service-architecture-real-llm-task";
const runIds = {
  requirementGenerate: "5101-requirement-generate",
  architectureGenerate: "5102-architecture-generate",
  architectureContract: "5103-architecture-contract",
};

export async function runHelloServiceArchitectureRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId: runIds.requirementGenerate, runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: realLlmTaskId,
      runId: runIds.architectureGenerate,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.architectureGenerate),
      { executionUnitId: "architecture_design_generate", runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: realLlmTaskId,
      runId: runIds.architectureContract,
      runtimeMode: "real",
    });
    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runIds.architectureContract),
      { executionUnitId: "architecture_design_contract", runtimeMode: "real" },
    );

    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.architectureContract, "architecture_design_contract_result.json"),
    );
    assert.equal(contractResult.passed, true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceArchitectureRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
