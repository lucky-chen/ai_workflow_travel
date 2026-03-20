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
const runId = "4845-work-execute-generator-success";

export async function runHelloServiceWorkExecuteGeneratorSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: successTaskId, runId },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: successTaskId,
      runId,
    });
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: successTaskId, runId },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "work_plan_generate"], {
      taskId: successTaskId,
      runId,
    });
    const preparedStepContextPath = await createPreparedStepContext(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute", "--prepared-step-context-path", preparedStepContextPath],
      { taskId: successTaskId, runId },
    );

    const result = await readJsonFile(path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "work_execute.json"));
    assert.equal(typeof result.prompt, "string");
    assert.equal(result.prompt.length > 0, true);
    assert.equal(
      result.prompt.includes("hello-service"),
      true,
    );
    assert.deepEqual(
      result.action,
      {
        tool: "external_execution",
        operation: "apply_workspace_change",
        targetPath: targetWorkspaceRoot,
        payload: {
          prompt: result.prompt,
        },
      },
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
