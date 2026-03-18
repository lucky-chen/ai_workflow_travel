import assert from "node:assert/strict";
import path from "node:path";
import {
  createWorkspaceCopy,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-contract-failure-task";
const runIds = {
  requirementGenerate: "2001-requirement-generate",
  architectureGenerate: "2002-architecture-generate",
  architectureContract: "2003-architecture-contract",
};

export async function runHelloServiceContractFailureTest() {
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
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_contract"], {
      taskId: failureTaskId,
      runId: runIds.architectureContract,
      extraEnv: {
        SDLC_TEST_CONTRACT_FAILURE_STAGES: "architecture_design_contract",
        SDLC_TEST_CONTRACT_ISSUE_CATEGORIES: "structure,alignment",
      },
    });

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runIds.architectureContract);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.architectureContract, "architecture_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, false);
    assert.equal(String(contractResult.summary).includes("failed contract checks"), true);
    const issueTypes = new Set(contractResult.issues.map((issue) => issue.checkItem));
    assert.equal(issueTypes.has("document_structure_complete"), true);
    assert.equal(issueTypes.has("cross_section_alignment"), true);
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
