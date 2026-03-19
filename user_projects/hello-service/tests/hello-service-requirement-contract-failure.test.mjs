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

const failureTaskId = "hello-service-requirement-contract-failure-task";
const runIds = {
  requirementGenerate: "3301-requirement-generate",
  requirementContract: "3302-requirement-contract",
};

export async function runHelloServiceRequirementContractFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: failureTaskId, runId: runIds.requirementGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "requirement_design_contract"], {
      taskId: failureTaskId,
      runId: runIds.requirementContract,
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.requirementContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.requirementContract, "requirement_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, false);
    assert.equal(String(contractResult.summary).includes("failed contract checks"), true);
    const issueTypes = new Set(contractResult.issues.map((issue) => issue.checkItem));
    assert.equal(issueTypes.has("document_structure_complete"), true);
    assert.equal(issueTypes.has("journey_and_goal_alignment"), true);
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
  runHelloServiceRequirementContractFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
