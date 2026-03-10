import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createHelloServiceRequirementDocument,
  findTraceRecordsByCaller,
  findTraceRecordsByEventType,
  loadTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-real-llm-task";

export async function runHelloServiceRealLlmTest() {
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

  const traceRecords = await loadTraceRecords(realLlmTaskId, "3000-req");
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "LlmExecutorService.execute").some(
      (entry) => entry.payload?.eventType === "llm_execution_started"
        && entry.scope?.stageId === "requirement_interpretation",
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "LlmExecutorService.execute").some(
      (entry) => entry.payload?.eventType === "llm_execution_finished"
        && entry.scope?.stageId === "requirement_interpretation",
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "LlmExecutorService.execute").some(
      (entry) => entry.payload?.eventType === "llm_execution_started"
        && entry.payload?.metadata?.mode === "real"
        && typeof entry.payload?.metadata?.provider === "string"
        && entry.payload.metadata.provider.length > 0,
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "DefaultPlanner.plan").some(
      (entry) => entry.payload?.eventType === "agent_plan_created",
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByCaller(traceRecords, "DefaultExecutor.execute").some(
      (entry) => entry.payload?.eventType === "agent_execution_started",
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByEventType(traceRecords, "stage_failed").length,
    0,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
