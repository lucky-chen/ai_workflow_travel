import assert from "node:assert/strict";
import {
  findTraceRecordsByCategory,
  findTraceRecordsByEventType,
  loadTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-contract-failure-task";

export async function runHelloServiceContractFailureTest() {
  const requirementRunId = "2001";
  const architectureFailureRunId = "2002";

  await resetWorkspace();
  await runCli(["init", "--workspace", workspaceRoot], { taskId: failureTaskId, runId: "2000" });

  await runCli(["generate", "--stage", "requirement_interpretation", "--workspace", workspaceRoot], { taskId: failureTaskId, runId: requirementRunId });
  await runCli(
    ["generate", "--stage", "architecture_design", "--workspace", workspaceRoot],
    {
      taskId: failureTaskId,
      runId: architectureFailureRunId,
      extraEnv: {
        SDLC_TEST_CONTRACT_FAILURE_STAGES: "architecture_design",
        SDLC_TEST_CONTRACT_ISSUE_CATEGORIES: "structure,alignment",
      },
    },
  );

  const traceRecords = await loadTraceRecords(failureTaskId, architectureFailureRunId);
  const contractRecords = findTraceRecordsByCategory(traceRecords, "contract");
  assert.equal(contractRecords.length, 1);
  assert.equal(contractRecords[0]?.scope?.stageId, "architecture_design");
  assert.equal(contractRecords[0]?.payload?.passed, false);
  assert.equal(contractRecords[0]?.summary.includes("failed contract checks"), true);
  assert.deepEqual(
    contractRecords[0]?.payload?.issues?.map((issue) => issue.checkItem),
    ["architecture_design-structure", "architecture_design-alignment"],
  );

  assert.equal(
    findTraceRecordsByEventType(traceRecords, "stage_failed").some(
      (entry) => entry.scope?.stageId === "architecture_design"
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByEventType(traceRecords, "artifact_persisted").some(
      (entry) => entry.scope?.stageId === "module_design",
    ),
    false,
  );
}
