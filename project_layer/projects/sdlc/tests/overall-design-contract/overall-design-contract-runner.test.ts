import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { InMemoryTraceRecorder } from "../../src/quality-gate/trace-recorder.js";
import { OverallDesignContractRunner } from "../../src/workflow/stage-runners/overall-design-contract-runner.js";
import { resolveOverallDesignContractResultArtifactPath } from "../../src/workflow/stage-runners/stage-artifact-paths.js";

export async function runOverallDesignContractRunnerTests(): Promise<void> {
  const workspaceRoot = await createTempDir("overall-design-contract-");

  try {
    await testOverallDesignContractRunnerPersistsResult(workspaceRoot);
    await testOverallDesignContractRunnerFailsWithoutRequiredInputs(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testOverallDesignContractRunnerPersistsResult(workspaceRoot: string): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const runner = new OverallDesignContractRunner({ traceRecorder });

  const output = await runner.run({
    taskId: "task-1",
    stageId: "overall_design_contract",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "sdlc/docs/Requirement.md",
      architecture_document: "sdlc/docs/TechnicalArchitecture.md",
      item_design_documents: JSON.stringify(["sdlc/docs/module_design/Workflow.md"]),
    },
  });

  assert.equal(output.success, true);
  assert.equal(output.summary, "Overall design contract passed.");
  assert.equal(
    output.artifacts.overall_design_contract_result,
    resolveOverallDesignContractResultArtifactPath(workspaceRoot),
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, resolveOverallDesignContractResultArtifactPath(workspaceRoot)), "utf8"),
    JSON.stringify(
      {
        passed: true,
        summary: "Overall design contract passed.",
        issues: [],
      },
      null,
      2,
    ),
  );
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "artifact_persisted",
  ]);
}

async function testOverallDesignContractRunnerFailsWithoutRequiredInputs(workspaceRoot: string): Promise<void> {
  const runner = new OverallDesignContractRunner();
  const output = await runner.run({
    taskId: "task-2",
    stageId: "overall_design_contract",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {},
  });

  assert.equal(output.success, false);
  assert.equal(output.summary, "Overall design contract failed.");
  const result = JSON.parse(output.artifacts.contract_result) as {
    passed: boolean;
    issues: Array<{ checkItem: string; message: string }>;
  };
  assert.equal(result.passed, false);
  assert.equal(result.issues.length >= 3, true);
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}
