import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createHelloServiceRequirementDocument,
  findTraceRecordsByCaller,
  hasRealLlmConfig,
  loadTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-real-llm-task";

export async function runHelloServiceRealLlmTest() {
  if (!(await hasRealLlmConfig())) {
    throw new Error("hello-service real LLM test requires a valid workspace local_env.json.");
  }

  await resetWorkspace();
  await runCli(["init", "--workspace", workspaceRoot], {
    taskId: realLlmTaskId,
    runId: "3000",
    runtimeMode: "real",
  });

  await mkdir(path.join(workspaceRoot, "sdlc", "docs", "requirements"), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, "sdlc", "docs", "requirements", "Requirement.md"),
    createHelloServiceRequirementDocument(),
    "utf8",
  );

  await runCli(["generate", "--stage", "requirement_interpretation", "--workspace", workspaceRoot], {
    taskId: realLlmTaskId,
    runId: "3000-req",
    runtimeMode: "real",
  });

  await runCli(["generate", "--stage", "architecture_design", "--workspace", workspaceRoot], {
    taskId: realLlmTaskId,
    runId: "3001",
    runtimeMode: "real",
  });

  const traceRecords = await loadTraceRecords(realLlmTaskId, "3001");
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "LlmExecutorService.execute").some(
      (entry) => entry.payload?.eventType === "llm_execution_started"
        && entry.scope?.stageId === "architecture_design",
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "LlmExecutorService.execute").some(
      (entry) => entry.payload?.eventType === "llm_execution_finished"
        && entry.scope?.stageId === "architecture_design",
    ),
    true,
  );
}
