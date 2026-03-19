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

const failureTaskId = "hello-service-item-design-contract-failure-task";
const runIds = {
  requirementGenerate: "3501-requirement-generate",
  architectureGenerate: "3502-architecture-generate",
  itemGenerate: "3503-item-generate",
  itemContract: "3504-item-contract",
};

export async function runHelloServiceItemDesignContractFailureTest() {
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
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: failureTaskId, runId: runIds.itemGenerate },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", "sdlc/docs/item_design/Workflow.md"],
      { taskId: failureTaskId, runId: runIds.itemContract },
    );

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.itemContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.itemContract, "item_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, false);
    const issueTypes = new Set(contractResult.issues.map((issue) => issue.checkItem));
    assert.equal(issueTypes.has("document_structure_complete"), true);
    assert.equal(issueTypes.has("section_contract_alignment"), true);
    assert.equal(issueTypes.has("format_consistency"), true);
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
  runHelloServiceItemDesignContractFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
