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
  writeItemDesignContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const successTaskId = "hello-service-item-design-contract-success-task";
const runId = "4701-item-design-contract";

export async function runHelloServiceItemDesignContractSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);
    await writeItemDesignContractSuccessFixture(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", "sdlc/docs/item_design/Workflow.md"],
      { taskId: successTaskId, runId },
    );

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runId);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "item_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "item_design_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "item_design_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceItemDesignContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
