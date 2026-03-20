import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUnitLlmTrace,
  createWorkspaceCopy,
  loadTraceRecords,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-requirement-generator-real-llm-task";
const runId = "5300-requirement-generator-real-llm";

export async function runHelloServiceRequirementGeneratorRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );

    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "requirement_design_generate", runtimeMode: "real" },
    );

    const document = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8");
    assert.match(document, /^# 1\. Background/m);
    assert.match(document, /hello-service/i);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceRequirementGeneratorRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
