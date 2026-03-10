import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createHelloServiceRequirementDocument,
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

  await mkdir(path.join(workspaceRoot, "sdlc", "docs", "requirements"), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, "sdlc", "docs", "requirements", "Requirement.md"),
    createHelloServiceRequirementDocument(),
    "utf8",
  );

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

  await assert.rejects(
    async () => access(path.join(workspaceRoot, "sdlc", "docs", "module_design", "Workflow.md")),
  );

  const traceRecords = await loadTraceRecords(failureTaskId, architectureFailureRunId);
  assert.equal(
    traceRecords.some(
      (entry) => entry.payload?.eventType === "stage_failed"
        && entry.scope?.stageId === "architecture_design",
    ),
    true,
  );
}
