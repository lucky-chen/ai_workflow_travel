import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createItemDescriptor,
  createPreparedStepContext,
  createWorkspaceCopy,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const successTaskId = "hello-service-work-execute-generator-success-task";
const runIds = {
  requirementGenerate: "4841-requirement-generate",
  architectureGenerate: "4842-architecture-generate",
  itemGenerate: "4843-item-generate",
  workPlanGenerate: "4844-work-plan-generate",
  workExecute: "4845-work-execute",
};

export async function runHelloServiceWorkExecuteGeneratorSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: successTaskId, runId: runIds.requirementGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: successTaskId,
      runId: runIds.architectureGenerate,
    });
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: successTaskId, runId: runIds.itemGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: successTaskId,
      runId: runIds.workPlanGenerate,
    });
    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: successTaskId, runId: runIds.workExecute },
    );

    const result = await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runIds.workExecute, "work_execute.json"));
    assert.equal(Array.isArray(result.changedFiles), true);
    assert.equal(
      result.changedFiles.some(
        (changedFile) =>
          changedFile.path === "src/index.ts"
          && changedFile.operation === "create"
          && String(changedFile.content).includes("hello-service"),
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceWorkExecuteGeneratorSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
