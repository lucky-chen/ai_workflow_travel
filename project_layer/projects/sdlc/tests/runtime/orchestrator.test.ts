import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ArtifactStoreService } from "../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../src/SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor } from "../../src/SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { RuntimeOrchestrator } from "../../src/Runtime/Orchestrator/index.js";

export async function runOrchestratorTests(): Promise<void> {
  await testRuntimeOrchestratorSupportsRequirementDesignUnitRun();
  await testRuntimeOrchestratorRejectsUnsupportedExecutionUnit();
}

async function testRuntimeOrchestratorSupportsRequirementDesignUnitRun(): Promise<void> {
  const workspaceRoot = await createTempDir("orchestrator-workspace-");
  const storageRoot = await createTempDir("orchestrator-storage-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Existing Requirement\n",
      "utf8",
    );

    const llmExecutor: ILlmExecutor = {
      async execute() {
        return {
          content: "# Generated Requirement\n\n- generated content\n",
          responseFormat: "text",
        };
      },
    };

    const traceRecorder = new InMemoryTraceRecorder();
    const orchestrator = new RuntimeOrchestrator({
      artifactStore: new ArtifactStoreService(storageRoot, traceRecorder),
      llmExecutor,
      traceRecorder,
    });

    const result = await orchestrator.run({
      request: {
        mode: "unit",
        executionUnitId: "requirement_design_generate",
        params: {
          userComment: "Generate requirement from orchestrator test.",
        },
      },
      context: {
        workspaceRoot,
        runId: "run-unit-1",
      },
    });

    assert.equal(result.accepted, true);
    assert.match(result.summary, /Requirement document generated/);
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8"),
      "# Generated Requirement\n\n- generated content\n",
    );
    await assert.rejects(
      readFile(
        path.join(storageRoot, "run-unit-1", "sdlc", "docs", "Requirement.md"),
        "utf8",
      ),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT",
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function testRuntimeOrchestratorRejectsUnsupportedExecutionUnit(): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const orchestrator = new RuntimeOrchestrator({
    artifactStore: new ArtifactStoreService(undefined, traceRecorder),
    llmExecutor: {
      async execute() {
        throw new Error("execute should not be called");
      },
    },
    traceRecorder,
  });

  await assert.rejects(
    async () => orchestrator.run({
      request: {
        mode: "unit",
        executionUnitId: "unknown_unit",
      },
      context: {
        workspaceRoot: "/tmp/project",
        runId: "run-unit-2",
      },
    }),
    /Unsupported execution unit/,
  );
}

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
