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
  await testRuntimeOrchestratorSupportsOverallDesignContractUnitRun();
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

async function testRuntimeOrchestratorSupportsOverallDesignContractUnitRun(): Promise<void> {
  const workspaceRoot = await createTempDir("orchestrator-overall-design-");
  const storageRoot = await createTempDir("orchestrator-overall-design-storage-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs", "item_design"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "# Requirement\n", "utf8");
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "# Architecture\n", "utf8");
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json"),
      JSON.stringify([{ documentPath: "sdlc/docs/item_design/Workflow.md" }], null, 2),
      "utf8",
    );
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "# Workflow\n", "utf8");

    const traceRecorder = new InMemoryTraceRecorder();
    const orchestrator = new RuntimeOrchestrator({
      artifactStore: new ArtifactStoreService(storageRoot, traceRecorder),
      llmExecutor: {
        async execute() {
          throw new Error("execute should not be called");
        },
      },
      traceRecorder,
    });

    const result = await orchestrator.run({
      request: {
        mode: "unit",
        executionUnitId: "overall_design_contract",
      },
      context: {
        workspaceRoot,
        runId: "run-overall-1",
      },
    });

    assert.equal(result.accepted, true);
    assert.match(result.summary, /overall design contract passed/i);
    const persisted = JSON.parse(
      await readFile(path.join(storageRoot, "run-overall-1", "overall_design_contract_result.json"), "utf8"),
    ) as { passed: boolean };
    assert.equal(persisted.passed, true);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
