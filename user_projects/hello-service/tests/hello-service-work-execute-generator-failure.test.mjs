import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  removeWorkspace,
  resetWorkspace,
  runCliExpectFailure,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-work-execute-generator-failure-task";
const runId = "3901-work-execute-failure";

export async function runHelloServiceWorkExecuteGeneratorFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    const result = await runCliExpectFailure(
      targetWorkspaceRoot,
      ["run", "unit", "work_execute"],
      { taskId: failureTaskId, runId },
    );

    assert.equal(result.stderr.includes("Missing required option: --prepared-step-context-path"), true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceWorkExecuteGeneratorFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
