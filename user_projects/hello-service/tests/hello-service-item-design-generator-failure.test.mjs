import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  removeWorkspace,
  resetWorkspace,
  runCliExpectFailure,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-item-design-generator-failure-task";
const runId = "3401-item-design-generate-failure";

export async function runHelloServiceItemDesignGeneratorFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    const result = await runCliExpectFailure(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate"],
      { taskId: failureTaskId, runId },
    );

    assert.equal(
      result.stderr.includes("Missing required option: --item-descriptor or --item-descriptor-path"),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceItemDesignGeneratorFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
