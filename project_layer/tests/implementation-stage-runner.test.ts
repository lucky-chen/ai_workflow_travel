import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { ImplementationGenerator } from "../src/execution/implementation-generator/implementation-generator.js";
import { ImplementationContractService } from "../src/contract/implementation-contract/implementation-contract.js";
import { InMemoryChangeGate } from "../src/quality-gate/change-gate/change-gate.js";
import { ImplementationStageRunner } from "../src/workflow/stage-runners/implementation-stage-runner.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../src/shared/contracts/llm-executor.js";
import type { IContractChecker, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";

export async function runImplementationStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("implementation-stage-runner-");
  const workspaceRoot = await createTempDir("workspace-runner-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  await artifactStore.writeArtifact({
    taskId: "task-1",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });
  await artifactStore.writeArtifact({
    taskId: "task-2",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });
  await artifactStore.writeArtifact({
    taskId: "task-3",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });

  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");

  try {
    const generator = new ImplementationGenerator({
      artifactStore,
      llmExecutor: new MockLlmExecutor({
        summary: "Planned implementation updates.",
        changed_files: [
          { path: "src/generated.ts", operation: "create", content: "export const generated = true;\n" },
          { path: "src/existing.ts", operation: "update", content: "export const value = 2;\n" },
          { path: "obsolete.txt", operation: "delete" },
        ],
      }),
    });
    const contractChecker = ImplementationContractService.create();

    const applyGate = new InMemoryChangeGate();
    const runner = new ImplementationStageRunner({
      generator,
      contractChecker,
      changeGate: applyGate,
    });

    const output = await runner.run({
      taskId: "task-1",
      stageId: "implementation",
      workspaceRoot,
      inputArtifacts: { moduleDesign: "module-design.md" },
      params: {
        moduleDesignStageId: "module-design",
        testCommand: 'node -e "process.exit(0)"',
      },
    });

    assert.equal(output.summary, "Planned implementation updates.");
    assert.equal(await readFile(path.join(workspaceRoot, "src", "generated.ts"), "utf8"), "export const generated = true;\n");
    assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 2;\n");
    await assert.rejects(access(path.join(workspaceRoot, "obsolete.txt")));
    assert.deepEqual(applyGate.getLastRequest()?.changedPaths, ["src/generated.ts", "src/existing.ts", "obsolete.txt"]);

    const rejectGate = new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Rejected in review.",
      },
    });
    const rejectRunner = new ImplementationStageRunner({
      generator,
      contractChecker,
      changeGate: rejectGate,
    });

    await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
    await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");
    await rm(path.join(workspaceRoot, "src", "generated.ts"), { force: true });

    await assert.rejects(
      rejectRunner.run({
        taskId: "task-2",
        stageId: "implementation",
        workspaceRoot,
        inputArtifacts: { moduleDesign: "module-design.md" },
        params: {
          moduleDesignStageId: "module-design",
          testCommand: 'node -e "process.exit(0)"',
        },
      }),
      /Change review ended with action "reject"/,
    );

    await assert.rejects(access(path.join(workspaceRoot, "src", "generated.ts")));
    assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 1;\n");
    assert.equal(await readFile(path.join(workspaceRoot, "obsolete.txt"), "utf8"), "to be deleted\n");

    const failingGate = new InMemoryChangeGate();
    const failingContractChecker: IContractChecker = {
      async check(_context: StageRunContext, _output: StageOutput): Promise<{
        passed: boolean;
        summary: string;
        issues: Array<{ checkItem: string; message: string; severity: "high" }>;
      }> {
        return {
          passed: false,
          summary: "Contract failed before apply.",
          issues: [{ checkItem: "implementation-contract", message: "failed", severity: "high" }],
        };
      },
    };
    const failingRunner = new ImplementationStageRunner({
      generator,
      contractChecker: failingContractChecker,
      changeGate: failingGate,
    });

    await assert.rejects(
      failingRunner.run({
        taskId: "task-3",
        stageId: "implementation",
        workspaceRoot,
        inputArtifacts: { moduleDesign: "module-design.md" },
        params: {
          moduleDesignStageId: "module-design",
          testCommand: 'node -e "process.exit(0)"',
        },
      }),
      /Implementation contract failed: Contract failed before apply\./,
    );

    assert.equal(failingGate.getLastRequest(), undefined);
    await assert.rejects(access(path.join(workspaceRoot, "src", "generated.ts")));
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class MockLlmExecutor implements ILlmExecutor {
  constructor(private readonly result: Record<string, unknown>) {}

  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: JSON.stringify(this.result),
      responseFormat: "json",
    };
  }
}
