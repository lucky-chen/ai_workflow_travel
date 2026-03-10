import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createHelloServiceArchitectureDocument,
  createHelloServiceImplementationPlanDocument,
  createHelloServiceModuleDesignDocument,
  createHelloServiceRequirementDocument,
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
  await runCli(["init", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: "1000" });

  await mkdir(path.join(workspaceRoot, "sdlc", "docs", "requirements"), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, "sdlc", "docs", "requirements", "Requirement.md"),
    createHelloServiceRequirementDocument(),
    "utf8",
  );

  await runCli(["generate", "--stage", "requirement_interpretation", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: requirementRunId });
  const requirementTraceRecords = await loadTraceRecords(baselineTaskId, requirementRunId);
  assert.equal(
    findTraceRecordsByCategory(requirementTraceRecords, "contract").some(
      (entry) => entry.scope?.stageId === "requirement_interpretation"
        && entry.payload?.passed === true,
    ),
    true,
  );

  await runCli(["generate", "--stage", "architecture_design", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: architectureRunId });
  const architectureTraceRecords = await loadTraceRecords(baselineTaskId, architectureRunId);
  assert.deepEqual(
    new Set(architectureTraceRecords.map((entry) => entry.category)),
    new Set(["trace", "contract", "review"]),
  );
  assert.equal(
    findTraceRecordsByCategory(architectureTraceRecords, "contract").some(
      (entry) => entry.scope?.stageId === "architecture_design"
        && entry.payload?.passed === true,
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCategory(architectureTraceRecords, "review").some(
      (entry) => entry.scope?.stageId === "architecture_design",
    ),
    true,
  );

  await runCli(["generate", "--stage", "module_design", "--workspace", workspaceRoot, "--target-module", "Workflow"], { taskId: baselineTaskId, runId: moduleRunId });
  const moduleTraceRecords = await loadTraceRecords(baselineTaskId, moduleRunId);
  assert.equal(
    findTraceRecordsByCategory(moduleTraceRecords, "contract").some(
      (entry) => entry.scope?.stageId === "module_design"
        && entry.payload?.passed === true,
    ),
    true,
  );

  await runCli(["generate", "--stage", "implementation_plan", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: implementationPlanRunId });
  const implementationPlanTraceRecords = await loadTraceRecords(baselineTaskId, implementationPlanRunId);
  assert.equal(
    findTraceRecordsByCategory(implementationPlanTraceRecords, "contract").some(
      (entry) => entry.scope?.stageId === "implementation_plan"
        && entry.payload?.passed === true,
    ),
    true,
  );

  await runCli(["generate", "--stage", "implementation_execution", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: implementationExecutionRunId });
  const implementationExecutionTraceRecords = await loadTraceRecords(baselineTaskId, implementationExecutionRunId);
  assert.equal(
    findTraceRecordsByCategory(implementationExecutionTraceRecords, "contract").some(
      (entry) => entry.scope?.stageId === "implementation_execution"
        && entry.payload?.passed === true,
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCategory(implementationExecutionTraceRecords, "review").some(
      (entry) => entry.scope?.stageId === "implementation_execution"
        && entry.payload?.changedPaths?.includes("src/index.ts") === true,
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByEventType(implementationExecutionTraceRecords, "step_completed").some(
      (entry) => entry.scope?.stageId === "implementation_execution",
    ),
    true,
  );

  await runCli(["generate", "--stage", "validation", "--workspace", workspaceRoot], { taskId: baselineTaskId, runId: validationRunId });

  assert.equal(
    await readFile(path.join(workspaceRoot, "sdlc", "docs", "requirements", "Requirement.md"), "utf8"),
    createHelloServiceRequirementDocument(),
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, "sdlc", "docs", "architecture", "TechnicalArchitecture.md"), "utf8"),
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
