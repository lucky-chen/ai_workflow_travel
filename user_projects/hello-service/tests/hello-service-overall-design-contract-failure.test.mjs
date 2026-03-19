import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadTraceRecords,
  createWorkspaceCopy,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-overall-design-contract-failure-task";
const runIds = {
  requirementGenerate: "3601-requirement-generate",
  architectureGenerate: "3602-architecture-generate",
  overallDesignContract: "3603-overall-design-contract",
};

export async function runHelloServiceOverallDesignContractFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: failureTaskId, runId: runIds.requirementGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: failureTaskId,
      runId: runIds.architectureGenerate,
    });
    await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design"), { recursive: true, force: true });
    await mkdir(path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design"), { recursive: true });
    await runCli(targetWorkspaceRoot, ["run", "unit", "overall_design_contract"], {
      taskId: failureTaskId,
      runId: runIds.overallDesignContract,
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.overallDesignContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.overallDesignContract, "overall_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, false);
    assert.equal(
      contractResult.issues.some((issue) => issue.checkItem === "overall_design_item_documents_present"),
      true,
    );
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
  runHelloServiceOverallDesignContractFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
