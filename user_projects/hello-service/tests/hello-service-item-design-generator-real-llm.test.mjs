import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUnitLlmTrace,
  createItemDescriptor,
  createWorkspaceCopy,
  getPrimaryItemDesignDocumentPath,
  loadTraceRecords,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-item-design-generator-real-llm-task";
const runId = "5500-item-generator-real-llm";

export async function runHelloServiceItemDesignGeneratorRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );

    await runCli(targetWorkspaceRoot, ["run", "unit", "architecture_design_generate"], {
      taskId: realLlmTaskId,
      runId,
      runtimeMode: "real",
    });

    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );

    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "item_design_generate", runtimeMode: "real" },
    );

    const document = await readFile(
      path.join(targetWorkspaceRoot, await getPrimaryItemDesignDocumentPath(targetWorkspaceRoot)),
      "utf8",
    );
    assert.match(document, /^# /m);
    assert.equal(/hello-service|EchoService/i.test(document), true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceItemDesignGeneratorRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
