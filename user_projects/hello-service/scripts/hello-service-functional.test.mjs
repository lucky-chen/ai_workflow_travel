import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createHelloServiceArchitectureDocument,
  createHelloServiceImplementationPlanDocument,
  createHelloServiceModuleDesignDocument,
  getTraceFilePath,
  loadTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const functionalTaskId = "hello-service-functional-task";

export async function runHelloServiceFunctionalTest() {
  const requirementRunId = "4001";
  const architectureRunId = "4002";
  const moduleRunId = "4003";
  const implementationPlanRunId = "4004";
  const implementationExecutionRunId = "4005";
  const validationRunId = "4006";

  await resetWorkspace();

  await runCli(["generate", "--stage", "requirement_interpretation", "--workspace", workspaceRoot], { taskId: functionalTaskId, runId: requirementRunId });
  await runCli(["generate", "--stage", "architecture_design", "--workspace", workspaceRoot], { taskId: functionalTaskId, runId: architectureRunId });
  await runCli(["generate", "--stage", "module_design", "--workspace", workspaceRoot, "--target-module", "Workflow"], { taskId: functionalTaskId, runId: moduleRunId });
  await runCli(["generate", "--stage", "implementation_plan", "--workspace", workspaceRoot], { taskId: functionalTaskId, runId: implementationPlanRunId });
  await runCli(["generate", "--stage", "implementation_execution", "--workspace", workspaceRoot], { taskId: functionalTaskId, runId: implementationExecutionRunId });
  await runCli(["generate", "--stage", "validation", "--workspace", workspaceRoot], { taskId: functionalTaskId, runId: validationRunId });

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

  const sourcePath = path.join(workspaceRoot, "src", "index.ts");
  const sourceContent = await readFile(sourcePath, "utf8");
  assert.equal(sourceContent, 'export function hello(): string {\n  return "hello-service";\n}\n');

  const validationTracePath = await getTraceFilePath(functionalTaskId, validationRunId);
  await access(validationTracePath);
  const validationTraceRecords = await loadTraceRecords(functionalTaskId, validationRunId);
  assert.equal(
    validationTraceRecords.some(
      (entry) => entry.scope?.stageId === "validation" && entry.summary.includes("Shell command passed"),
    ),
    true,
  );
  const validationArtifact = JSON.parse(
    await readFile(
      path.join(
        workspaceRoot,
        ".artifact-store",
        functionalTaskId,
        "validation",
        "reports/validation/ValidationResult.json",
      ),
      "utf8",
    ),
  );
  assert.equal(validationArtifact.passed, true);
  assert.equal(String(validationArtifact.logs ?? "").includes("hello-service mock shell check passed."), true);
}
