import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  removeWorkspace,
  resetWorkspace,
  runCliExpectFailure,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-requirement-generator-failure-task";
const runId = "3201-requirement-generate-failure";

export async function runHelloServiceRequirementGeneratorFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    const result = await runCliExpectFailure(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate"],
      { taskId: failureTaskId, runId },
    );

    assert.equal(result.stderr.includes("Missing required option: --user-comment"), true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceRequirementGeneratorFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
