import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertHelloServiceStageCallChain,
  createHelloServiceArchitectureDocument,
  createHelloServiceImplementationPlanDocument,
  createHelloServiceModuleDesignDocument,
  findTraceRecordsByCategory,
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

  await runCli(["generate", "--stage", "validation", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: validationRunId });

  assert.equal(
    await readFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8"),
    createHelloServiceArchitectureDocument(),
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, "sdlc", "docs", "module_design", "Workflow.md"), "utf8"),
    createHelloServiceModuleDesignDocument(),
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, "sdlc", "docs", "CodeGenerationExecutionPlan.md"), "utf8"),
    createHelloServiceImplementationPlanDocument(),
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, "src", "index.ts"), "utf8"),
    'export function hello(): string {\n  return "hello-service";\n}\n',
  );
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
}
