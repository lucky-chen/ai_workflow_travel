import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import {
  assertHelloServiceStageCallChain,
  findTraceRecordsByCategory,
  findTraceRecordsByEventType,
  findTraceRecordsByStage,
  getTraceFilePath,
  loadTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const baselineTaskId = "hello-service-task";

export async function runHelloServiceSuccessTest() {
  const requirementRunId = "1001";
  const architectureRunId = "1002";
  const moduleRunId = "1003";
  const implementationPlanRunId = "1004";
  const implementationExecutionRunId = "1005";
  const validationRunId = "1006";

  await resetWorkspace();

  await runCli(["generate", "--stage", "requirement_interpretation", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: requirementRunId });
  const requirementTraceRecords = await loadTraceRecords(baselineTaskId, requirementRunId);
  assertHelloServiceStageCallChain(requirementTraceRecords, {
    workflowStageId: "requirement_interpretation",
    runtimeMode: "mock",
  });

  await runCli(["generate", "--stage", "architecture_design", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: architectureRunId });
  const architectureTraceRecords = await loadTraceRecords(baselineTaskId, architectureRunId);
  assert.deepEqual(
    new Set(architectureTraceRecords.map((entry) => entry.category)),
    new Set(["trace", "contract", "review"]),
  );
  assertHelloServiceStageCallChain(architectureTraceRecords, {
    workflowStageId: "architecture_design",
    runtimeMode: "mock",
  });

  await runCli(["generate", "--stage", "module_design", "--workspace", workspaceRoot, "--target-module", "Workflow"], { taskId: baselineTaskId, runId: moduleRunId });
  const moduleTraceRecords = await loadTraceRecords(baselineTaskId, moduleRunId);
  assertHelloServiceStageCallChain(moduleTraceRecords, {
    workflowStageId: "module_design",
    runtimeMode: "mock",
  });

  await runCli(["generate", "--stage", "implementation_plan", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: implementationPlanRunId });
  const implementationPlanTraceRecords = await loadTraceRecords(baselineTaskId, implementationPlanRunId);
  assertHelloServiceStageCallChain(implementationPlanTraceRecords, {
    workflowStageId: "implementation_plan",
    runtimeMode: "mock",
  });

  await runCli(["generate", "--stage", "implementation_execution", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: implementationExecutionRunId });
  const implementationExecutionTraceRecords = await loadTraceRecords(baselineTaskId, implementationExecutionRunId);
  assertHelloServiceStageCallChain(implementationExecutionTraceRecords, {
    workflowStageId: "implementation_execution",
    llmStageId: "implementation",
    runtimeMode: "mock",
    expectReviewPath: "src/index.ts",
    expectStepCompleted: true,
    expectAgentExecutionFinished: true,
  });
  assert.equal(
    findTraceRecordsByCategory(implementationExecutionTraceRecords, "contract").some(
      (entry) => entry.scope?.stageId === "implementation_execution" && entry.payload?.passed === true,
    ),
    true,
  );

  await runCli(["generate", "--stage", "validation", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: validationRunId });
  const traceFilePath = await getTraceFilePath(baselineTaskId, validationRunId);
  await access(traceFilePath);
  const traceRecords = await loadTraceRecords(baselineTaskId, validationRunId);
  assert.deepEqual(
    new Set(traceRecords.map((entry) => entry.category)),
    new Set(["trace", "artifact"]),
  );
  assert.equal(
    findTraceRecordsByStage(traceRecords, "validation").some(
      (entry) => entry.payload?.eventType === "artifact_persisted",
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByEventType(traceRecords, "validation_finished").some(
      (entry) => entry.scope?.stageId === "validation",
    ),
    true,
  );
  const validationArtifact = JSON.parse(
    await readFile(
      `${workspaceRoot}/.artifact-store/${baselineTaskId}/validation/reports/validation/ValidationResult.json`,
      "utf8",
    ),
  );
  assert.equal(validationArtifact.passed, true);
  assert.equal(validationArtifact.command, `cd "${workspaceRoot}" && npm test`);
  assert.equal(String(validationArtifact.logs ?? "").includes("hello-service mock shell check passed."), true);
}
