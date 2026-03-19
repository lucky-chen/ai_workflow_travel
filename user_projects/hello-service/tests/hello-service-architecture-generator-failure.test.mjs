import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  removeWorkspace,
  resetWorkspace,
  runCliExpectFailure,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-architecture-generator-failure-task";
const runId = "4501-architecture-generate-failure";

export async function runHelloServiceArchitectureGeneratorFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);
    await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "Requirement.md"), { force: true });

    const result = await runCliExpectFailure(
      targetWorkspaceRoot,
      ["run", "unit", "architecture_design_generate"],
      { taskId: failureTaskId, runId },
    );

    assert.equal(
      result.stderr.includes("Requirement.md") || result.stderr.includes("ENOENT"),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceArchitectureGeneratorFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
