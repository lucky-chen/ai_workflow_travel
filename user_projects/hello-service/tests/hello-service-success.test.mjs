import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createHelloServiceArchitectureDocument,
  createHelloServiceImplementationPlanDocument,
  createHelloServiceModuleDesignDocument,
  createHelloServiceRequirementDocument,
  findTraceFilePath,
  loadAllTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const baselineTaskId = "hello-service-task";

export async function runHelloServiceSuccessTest() {
  await resetWorkspace();
  await runCli(["init", "--workspace", workspaceRoot], { taskId: baselineTaskId });

  await mkdir(path.join(workspaceRoot, "sdlc", "docs", "requirements"), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, "sdlc", "docs", "requirements", "Requirement.md"),
    createHelloServiceRequirementDocument(),
    "utf8",
  );

  await runCli(["generate", "--stage", "requirement_interpretation", "--workspace", workspaceRoot], { taskId: baselineTaskId });
  await runCli(["generate", "--stage", "architecture_design", "--workspace", workspaceRoot], { taskId: baselineTaskId });
  await runCli(["generate", "--stage", "module_design", "--workspace", workspaceRoot, "--target-module", "Workflow"], { taskId: baselineTaskId });
  await runCli(["generate", "--stage", "implementation_plan", "--workspace", workspaceRoot], { taskId: baselineTaskId });
  await runCli(["generate", "--stage", "implementation_execution", "--workspace", workspaceRoot], { taskId: baselineTaskId });
  await runCli(["generate", "--stage", "validation", "--workspace", workspaceRoot], { taskId: baselineTaskId });

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
  const traceFilePath = await findTraceFilePath(baselineTaskId);
  await access(traceFilePath);

  const traceRecords = await loadAllTraceRecords(baselineTaskId);
  assert.deepEqual(
    new Set(traceRecords.map((entry) => entry.category)),
    new Set(["trace", "contract", "review", "artifact"]),
  );
}
