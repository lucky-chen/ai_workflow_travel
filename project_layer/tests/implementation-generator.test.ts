import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { ImplementationGenerator } from "../src/execution/implementation-generator/implementation-generator.js";
import { ProjectContextLoader } from "../src/execution/implementation-generator/project-context-loader.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../src/shared/contracts/llm-executor.js";
import type { ProjectFile } from "../src/shared/types/common.js";

export async function runImplementationGeneratorTests(): Promise<void> {
  const storageRoot = await createTempDir("implementation-generator-");
  const workspaceRoot = await createTempDir("workspace-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  await artifactStore.writeArtifact({
    taskId: "task-1",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });

  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");
  await mkdir(path.join(workspaceRoot, "dist"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "dist", "ignored.txt"), "ignored\n", "utf8");

  try {
    const generator = new ImplementationGenerator(
      {
        artifactStore,
        llmExecutor: new MockLlmExecutor({
          summary: "Applied implementation updates.",
          changed_files: [
            {
              path: "src/generated.ts",
              operation: "create",
              content: "export const generated = true;\n",
            },
            {
              path: "src/existing.ts",
              operation: "update",
              content: "export const value = 2;\n",
            },
            {
              path: "obsolete.txt",
              operation: "delete",
            },
          ],
        }),
      },
    );

    const output = await generator.run({
      taskId: "task-1",
      stageId: "implementation",
      workspaceRoot,
      inputArtifacts: {
        moduleDesign: "module-design.md",
      },
      params: {
        moduleDesignStageId: "module-design",
      },
    });

    assert.equal(output.stageId, "implementation");
    assert.equal(output.success, true);
    assert.equal(output.summary, "Applied implementation updates.");
    assert.deepEqual(output.artifacts.changedFiles, [
      {
        path: "src/generated.ts",
        operation: "create",
        content: "export const generated = true;\n",
      },
      {
        path: "src/existing.ts",
        operation: "update",
        content: "export const value = 2;\n",
      },
      {
        path: "obsolete.txt",
        operation: "delete",
        content: undefined,
      },
    ]);

    await assert.rejects(access(path.join(workspaceRoot, "src", "generated.ts")));
    assert.equal(
      await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"),
      "export const value = 1;\n",
    );
    assert.equal(await readFile(path.join(workspaceRoot, "obsolete.txt"), "utf8"), "to be deleted\n");

    const projectContextLoader = new ProjectContextLoader();
    const projectContext = await projectContextLoader.loadProjectContext({
      taskId: "task-1",
      stageId: "implementation",
      workspaceRoot,
      inputArtifacts: {
        moduleDesign: "module-design.md",
      },
    });
    assert.equal(projectContext.relevantFiles.some((file: ProjectFile) => file.path === "dist/ignored.txt"), false);

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
