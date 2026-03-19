import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  removeWorkspace,
  resetWorkspace,
  runCli,
  runCliExpectFailure,
} from "./hello-service-test-helpers.mjs";

const failureTaskId = "hello-service-work-plan-generator-failure-task";
const runIds = {
  requirementGenerate: "4601-requirement-generate",
  architectureGenerate: "4602-architecture-generate",
  workPlanGenerate: "4603-work-plan-generate-failure",
};

export async function runHelloServiceWorkPlanGeneratorFailureTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: failureTaskId, runId: runIds.requirementGenerate },
    );
    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: failureTaskId,
      runId: runIds.architectureGenerate,
    });

    const result = await runCliExpectFailure(
      targetWorkspaceRoot,
      ["run", "unit", "work_plan_generate"],
      { taskId: failureTaskId, runId: runIds.workPlanGenerate },
    );

    assert.equal(
      result.stderr.includes("item_design") || result.stderr.includes("ENOENT"),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceWorkPlanGeneratorFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
